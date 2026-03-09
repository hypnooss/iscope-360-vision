

# Fix: WHOIS lookup falhando para domínios .br (403)

## Diagnóstico

Os logs confirmam o problema:
```
RDAP failed (403) — movecta.com.br
RDAP failed (403) — localfrio.com.br
RDAP failed (403) — altamogiana.com.br
```

O `rdap.registro.br` está retornando **403 Forbidden** para chamadas vindas de IPs de cloud (Supabase Edge Functions rodam na Deno Deploy/Fly.io). Isso é comum — registro.br bloqueia requisições de datacenters. Domínios não-.br funcionam normalmente (ex: `precisio.services` retornou dados com sucesso via `rdap.org`).

Os campos `whois_registrar`, `whois_expires_at` e `whois_checked_at` estão `NULL` no banco para ambos os domínios.

## Solução

Adicionar **fallback chain** na edge function `domain-whois-lookup`:

1. **Tentativa 1**: RDAP direto (`rdap.registro.br` para .br, `rdap.org` para outros) — já existe
2. **Tentativa 2 (novo)**: IANA bootstrap discovery (`https://data.iana.org/rdap/dns.json`) para encontrar servidores RDAP alternativos
3. **Tentativa 3 (novo)**: Usar API pública gratuita como fallback — `https://rdap.org/domain/{domain}` mesmo para .br (o rdap.org faz bootstrap automaticamente e pode ter acesso diferente)
4. **Tentativa 4 (novo)**: Query WHOIS via `whois-json` API pública (`https://api.whoisfreaks.com/v1.0/whois?apiKey=free&domainName={domain}` ou similar serviço gratuito que aceita .br)

Para manter simples e sem API keys, a abordagem principal será:
- Para `.br`: tentar `rdap.registro.br` → fallback para `https://rdap.org/domain/{domain}` (que faz bootstrap) → fallback para parsing de WHOIS text via API pública
- Adicionar User-Agent header (alguns servidores bloqueiam requests sem UA)
- Adicionar retry com delay entre tentativas

### Arquivo alterado
- `supabase/functions/domain-whois-lookup/index.ts`

### Resultado esperado
Após redeploy, executar Domain Compliance novamente nos domínios .br deve popular os campos WHOIS. A aba "Domínios Externos" na Gestão de Ativos passará a exibir registrar e data de expiração.

