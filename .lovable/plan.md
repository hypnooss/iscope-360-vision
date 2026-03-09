

# Melhorar coleta WHOIS via Agent (TCP Socket)

## Diagnóstico

Os logs confirmam que a edge function `domain-whois-lookup` **não está executando a fallback chain** — para domínios `.br`, ela falha no `rdap.registro.br` (403) e para por aí. Os fallbacks (rdap.org, WhoisFreaks) não estão sendo acionados, o que indica que a versão deployada pode ainda ser a antiga, ou os fallbacks também falham (rdap.org redireciona para registro.br que bloqueia IPs de cloud).

**Apenas domínios GoDaddy funcionaram** (taschibra.com, precisio.services) porque o `rdap.org` resolve diretamente sem redirecionar para um servidor que bloqueia cloud.

Todos os `.br` falharam: movecta.com.br, localfrio.com.br, altamogiana.com.br, nexta.com.br, estrela.com.br, etc.

## Solução: WHOIS via Agent (TCP Socket)

O Agent já possui infraestrutura de WHOIS via socket TCP (`asn_classifier.py` → `_query_whois_server`). A solução mais robusta é **adicionar um step de Domain WHOIS no blueprint do external_domain**, executado pelo Agent on-premise, que não é bloqueado por registro.br.

### Implementação

**1. Novo executor: `domain_whois.py`**

Criar executor que consulta `whois.registro.br` (para .br) ou `whois.verisign-grs.com` (para .com/.net) via TCP socket na porta 43. Extrair campos:
- `expires` (regex: `expires:`, `Registry Expiry Date:`, `Expiration Date:`)
- `created` (regex: `created:`, `Creation Date:`)
- `registrar` (regex: `registrar:`, `Registrar:`)
- `owner` (regex: `owner:`)

Reutilizar o padrão do `_query_whois_server` do `asn_classifier.py`.

**2. Adicionar step no blueprint (banco)**

Inserir novo step no blueprint `external_domain`:
```json
{
  "id": "domain_whois",
  "type": "domain_whois",
  "executor": "agent",
  "config": {
    "optional": true,
    "whois_servers": {
      ".br": "whois.registro.br",
      ".com": "whois.verisign-grs.com",
      ".net": "whois.verisign-grs.com",
      "default": "whois.iana.org"
    }
  }
}
```

**3. Registrar executor no Agent**

Registrar `domain_whois` no mapeamento de executors do Agent (em `__init__.py` ou no task runner).

**4. Atualizar `trigger-external-domain-analysis` / Edge Function de processamento**

Quando o resultado do step `domain_whois` chegar via `task_step_results`, extrair os campos e fazer UPDATE na tabela `external_domains` (whois_registrar, whois_expires_at, etc.). Isso substitui a chamada direta à edge function `domain-whois-lookup`.

**5. Manter edge function como fallback**

A edge function `domain-whois-lookup` continua existindo para domínios não-.br (onde RDAP funciona) e para consultas manuais. O Agent é a fonte primária.

### Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `python-agent/agent/executors/domain_whois.py` | **Novo** — executor WHOIS via socket TCP |
| `python-agent/agent/executors/__init__.py` | Registrar novo executor |
| Blueprint no banco (`device_blueprints`) | Adicionar step `domain_whois` |
| Edge function de processamento de resultados | Processar step result e salvar em `external_domains` |

### Por que via Agent

- **registro.br bloqueia IPs de cloud** (403 confirmado nos logs)
- O Agent roda na rede do cliente, com IP residencial/corporativo — não é bloqueado
- Já existe infraestrutura de WHOIS socket no Agent (`asn_classifier.py`)
- É a abordagem mais confiável para qualquer TLD que bloqueie datacenters

