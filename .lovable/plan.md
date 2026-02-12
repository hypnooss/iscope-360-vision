
# Corrigir Edge Function attack-surface-scan

## Problemas Encontrados

O scan executou com sucesso, mas retornou 0 IPs por dois bugs na edge function:

### Bug 1: Coluna errada na tabela `task_step_results`
A edge function busca `step.result_data`, mas a coluna real chama-se `data`.

### Bug 2: Formato de IPs dos subdominios nao reconhecido
A funcao `extractDomainIPs()` procura por:
- `subdomainSummary.subdomains[*].addresses[*].ip` 
- `checks[*].rawData` com campos `ip` ou `address`

Mas o formato real dos dados de enumeracao de subdominios (source: api) e:
```json
{
  "type": "subdomain_enumeration",
  "subdomains": [
    { "subdomain": "briimage.example.com", "ips": ["3.133.227.151"], "is_alive": true }
  ]
}
```

Os IPs estao em `report_data.subdomains[*].ips[]` (array de strings), nao dentro de `subdomainSummary.subdomains[*].addresses[*].ip`.

### Dado adicional: Firewall WAN IPs
As interfaces WAN do firewall deste cliente sao tuneis com IPs privados (`10.0.0.13`), entao e esperado que nao retornem IPs publicos. A logica de filtragem RFC1918 esta correta. Os IPs publicos virao primariamente dos subdominios DNS.

## Correcoes

### Arquivo: `supabase/functions/attack-surface-scan/index.ts`

**Correcao 1**: Na funcao `extractDomainIPs()`, adicionar Path 0 para o formato de subdomain enumeration:
- Buscar `report_data.subdomains[]` (array)
- Para cada subdomain, iterar `subdomain.ips[]` (array de strings)
- Criar SourceIP com `source: 'dns'` e `label: subdomain.subdomain`

**Correcao 2**: Na secao de firewall, alterar `step.result_data` para `step.data`.

**Correcao 3**: Ao buscar analises de dominio, buscar AMBOS os tipos (agent e api), pois os IPs estao nas analises de source `api` (subdomain enumeration), nao nas de source `agent` (compliance).

### Resultado esperado
Com essas correcoes, o scan devera encontrar pelo menos os IPs:
- `3.133.227.151` (briimage.brinquedosestrela.com.br)
- `3.132.6.138` (brilink, brispf.brinquedosestrela.com.br)
- `13.248.161.86` e `76.223.33.242` (www.brinquedosestrela.com.br)
- Mais IPs do dominio estrela.com.br
