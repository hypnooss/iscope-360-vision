

# Fix: Paises nao aparecem no Analyzer de Autenticacao

## Causa Raiz

Os endpoints de coleta de autenticacao e VPN no blueprint nao incluem o parametro `extra=country_id`, que e suportado pela API FortiOS tanto em 7.2 quanto em 7.4 para endpoints `/memory/event/{subtype}`.

Sem esse parametro, os logs de autenticacao chegam sem o campo `srccountry`. O mecanismo de fallback (`ipCountryMap`) tenta cruzar IPs com dados do trafego negado, mas neste caso o trafego negado e todo interno (10.x.x.x = "Reserved"), entao nao ha correspondencia para os IPs externos de autenticacao (62.60.x.x, 85.239.x.x).

## Solucao

Adicionar `&extra=country_id` aos steps `auth_events` e `vpn_events` no blueprint do Analyzer. A API do FortiOS confirma suporte a esse parametro em `/memory/event/{subtype}` (documentacao linhas 946-952).

## Detalhes Tecnicos

### Alteracao no Blueprint (SQL)

| Step | Path Atual | Path Corrigido |
|---|---|---|
| `auth_events` (index 1) | `/api/v2/log/memory/event/system?filter=subtype==system&rows=500` | `/api/v2/log/memory/event/system?filter=subtype==system&rows=500&extra=country_id` |
| `vpn_events` (index 2) | `/api/v2/log/memory/event/vpn?filter=subtype==vpn&rows=500` | `/api/v2/log/memory/event/vpn?filter=subtype==vpn&rows=500&extra=country_id` |

Execucao via `UPDATE` com `jsonb_set` no registro do blueprint `9e33ae45-053c-4ea2-9723-c9e0cf01549c`.

### Sem alteracao em codigo

A Edge Function `firewall-analyzer` ja le `srccountry` dos logs (linha 222: `log.srccountry || log.src_country`). Quando o campo existir nos dados coletados, os rankings de paises serao populados automaticamente.

## Resultado esperado

- "Top Paises - Autenticacao" exibira os paises de origem dos IPs de login (ex: pais de 62.60.131.x e 85.239.146.x)
- Mapa de Ataques tera dados de geolocalizacao para eventos de autenticacao
- Nenhum impacto nos demais steps do blueprint
