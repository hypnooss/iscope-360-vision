

# Enriquecer ASN Classifier com RDAP e exibir tooltip no IP

## Resumo

Adicionar uma consulta RDAP (via HTTPS) ao executor `asn_classifier` do Python Agent para coletar dados adicionais: organizacao registrante, pais, e-mail de contato tecnico/abuse e range do bloco IP. No frontend, substituir o badge de ASN por um tooltip rico que aparece ao passar o mouse sobre o IP.

## Alteracoes

### 1. Python Agent - `asn_classifier.py`

Apos o WHOIS lookup existente, adicionar uma consulta RDAP via HTTPS para enriquecer os dados:

- Consultar `https://rdap.registro.br/ip/{ip}` (LACNIC/BR) com fallback para `https://rdap.arin.net/registry/ip/{ip}` e `https://rdap.db.ripe.net/ip/{ip}`
- Extrair do JSON RDAP:
  - `country` (campo `country` no topo)
  - `registrant_org` (entidade com role "registrant", campo `fn` do vCard)
  - `abuse_email` (entidade com role "abuse", campo `email` do vCard)
  - `tech_email` (entidade com role "technical", campo `email` do vCard)
  - `ip_range` (campos `startAddress` + `endAddress`, ex: "45.172.216.0 - 45.172.217.255")
  - `autnum` (campo `nicbr_autnum` ou extraido do handle)

- O retorno do executor passa de:
```python
{
  'data': {
    'ip': ip,
    'is_cdn': False,
    'provider': 'unknown',
    'asn': 'AS268794',
    'org': 'FINCH BRASIL...',
  }
}
```
Para:
```python
{
  'data': {
    'ip': ip,
    'is_cdn': False,
    'provider': 'unknown',
    'asn': 'AS268794',
    'org': 'FINCH BRASIL...',
    'country': 'BR',
    'abuse_email': 'datacenterfinch@gmail.com',
    'tech_email': 'datacenterfinch@gmail.com',
    'ip_range': '45.172.216.0 - 45.172.217.255',
  }
}
```

- A consulta RDAP e feita via `urllib.request` (stdlib) com timeout de 5s e try/except para nao impactar o fluxo caso falhe.

**Logica de descoberta do servidor RDAP correto:**
1. Primeiro tenta o bootstrap IANA: `https://rdap.iana.org/ip/{ip}` (redireciona para o RIR correto)
2. Fallback direto para servidores conhecidos se o bootstrap falhar

### 2. Interface ExposedAsset - `AttackSurfaceAnalyzerPage.tsx`

Atualizar a interface `ExposedAsset.asn` para incluir os novos campos:

```text
asn: {
  asn: string;
  provider: string;
  org: string;
  is_cdn: boolean;
  country?: string;
  abuse_email?: string;
  tech_email?: string;
  ip_range?: string;
} | null;
```

### 3. Tooltip no IP - `AttackSurfaceAnalyzerPage.tsx`

No componente `AssetCard`, envolver o IP (e o badge ASN) com um `Tooltip` rico que exibe:

```text
+------------------------------------------+
| AS268794 (FINCH BRASIL SOLUCOES...)      |
| Pais: BR  [bandeira]                     |
| Range: 45.172.216.0 - 45.172.217.255     |
| Abuse: datacenterfinch@gmail.com         |
| Tecnico: datacenterfinch@gmail.com       |
+------------------------------------------+
```

- O tooltip aparece ao passar o mouse sobre o endereco IP (ja exibido como `font-mono`)
- Usar `TooltipProvider` + `Tooltip` + `TooltipTrigger asChild` com `<span>` wrapper (mesmo padrao corrigido nos breach types)
- `TooltipContent side="top"` com `max-w-sm`
- Exibir bandeira do pais usando o pacote `flag-icons` ja instalado
- Se nao houver dados RDAP, o tooltip mostra apenas ASN e org (dados atuais do WHOIS)

### 4. Dados ja coletados continuam funcionando

Os snapshots antigos (sem campos RDAP) continuam exibindo normalmente - os novos campos sao opcionais (`?`). Apenas novos scans trarao os dados enriquecidos.

## Sequencia de implementacao

1. Atualizar `python-agent/agent/executors/asn_classifier.py` - adicionar consulta RDAP
2. Atualizar `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`:
   - Expandir interface `ExposedAsset.asn`
   - Adicionar tooltip rico no IP dentro do `AssetCard`

