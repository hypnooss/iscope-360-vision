

# Enriquecimento Multi-Source: InternetDB + SecurityTrails

## Problema atual

A API principal do Shodan (`/shodan/host/{ip}`) retorna erro 403 para a maioria dos IPs devido a restricoes do plano. Isso resulta em dados de enriquecimento vazios para quase todos os IPs descobertos.

## Solucao

Implementar uma estrategia de enriquecimento em cascata com 3 fontes, na edge function `attack-surface-scan`:

```text
Para cada IP:
  1. Shodan API principal (se key configurada)
     |
     +-- Sucesso? Usar dados completos (ports, services, banners, vulns, os)
     |
     +-- Erro 403/404? Fallback para InternetDB
                          |
  2. Shodan InternetDB (gratuito, sem autenticacao)
     |
     +-- Retorna: ports, vulns, cpes, hostnames, tags
     |
  3. SecurityTrails (se key configurada)
     |
     +-- Complementa com: reverse DNS, dominios associados ao IP
```

## Mudancas tecnicas

### Arquivo: `supabase/functions/attack-surface-scan/index.ts`

#### 1. Nova funcao `queryInternetDB(ip)`
- Endpoint: `https://internetdb.shodan.io/{ip}`
- Gratuito, sem autenticacao, sem rate limit agressivo
- Retorna: `ports`, `vulns`, `cpes`, `hostnames`, `tags`
- Mapeamento para o mesmo formato `ShodanResult` existente (services gerados a partir dos ports/cpes)

#### 2. Nova funcao `querySecurityTrails(ip, apiKey)`
- Endpoint: `https://api.securitytrails.com/v1/ips/nearby/{ip}` e/ou reverse DNS
- Header: `APIKEY: {apiKey}`
- Complementa hostnames e dominios associados ao IP

#### 3. Alterar `queryShodan()` para retornar fallback automatico
- Se a API principal retornar 403, chamar `queryInternetDB()` automaticamente
- Marcar a `source` do resultado (ex: `enrichment_source: 'shodan' | 'internetdb' | 'securitytrails'`)

#### 4. Leitura das API keys com fallback DB -> env
- Buscar `SHODAN_API_KEY` e `SECURITYTRAILS_API_KEY` primeiro na tabela `system_settings` (criptografado), com fallback para `Deno.env.get()`
- Reaproveitar a logica de decrypt que ja existe em `manage-api-keys`

#### 5. Integrar SecurityTrails no fluxo principal
- Apos o enriquecimento Shodan/InternetDB, para cada IP, consultar SecurityTrails para adicionar hostnames adicionais
- Rate limit respeitado (2 req/sec para SecurityTrails)

#### 6. Campo `enrichment_source` nos resultados
- Cada IP no `resultsMap` tera um campo indicando de onde vieram os dados: `shodan`, `internetdb`, `securitytrails` ou `mixed`
- Permite que a UI futuramente mostre badges diferenciados

### Resultado esperado

- IPs que antes retornavam "Shodan API error: 403" agora terao dados do InternetDB (portas, CVEs, CPEs)
- SecurityTrails complementa com DNS reverso e dominios associados
- O score de exposicao sera calculado com dados reais em vez de ficar zerado
- Nenhuma mudanca no frontend necessaria neste momento (dados continuam no mesmo formato)
