

# Fix: GeoIP Fallback para FortiOS 7.2 (e anteriores)

## Problema

O FortiOS 7.2 nao retorna o campo `srccountry` nos logs de autenticacao/VPN, mesmo com o parametro `extra=country_id`. O FortiOS 7.4 retorna esse campo nativamente, por isso o BAU-FW funciona e o BR-PMP-FW-001 nao.

O fallback atual (cruzar IPs com dados de trafego negado) falha porque o trafego negado do BR-PMP e todo interno (10.x.x.x / "Reserved").

## Solucao

Adicionar resolucao GeoIP via API gratuita (`ip-api.com/batch`) na Edge Function `firewall-analyzer` como fallback final para IPs externos sem pais.

## Alteracao Unica

**Arquivo:** `supabase/functions/firewall-analyzer/index.ts`

### 1. Nova funcao `resolveGeoIP`

Funcao auxiliar que:
- Recebe lista de IPs sem pais
- Filtra IPs privados (10.x, 172.16-31.x, 192.168.x, 127.x)
- Faz batch POST para `http://ip-api.com/batch` (gratuito, sem API key, ate 100 IPs)
- Retorna mapa IP -> nome do pais
- Timeout de 5s, fallback silencioso em caso de erro

### 2. Integracao no fluxo principal (linhas ~739-741)

Apos construir o `ipCountryMap` a partir dos logs, antes de chamar `analyzeAuthentication`:

```text
ipCountryMap construido (denied + auth/vpn logs)
         |
         v
Coletar IPs unicos de auth/vpn SEM pais no mapa
         |
         v
Filtrar IPs privados (RFC1918)
         |
         v
Batch GeoIP lookup (ip-api.com) - max 100 IPs
         |
         v
Adicionar resultados ao ipCountryMap
         |
         v
analyzeAuthentication(..., ipCountryMap)
```

## Detalhes da API ip-api.com

- Endpoint: `POST http://ip-api.com/batch`
- Body: array de objetos `[{"query": "62.60.131.x", "fields": "query,country"}]`
- Limite: 100 IPs por request, 45 requests/minuto
- Sem necessidade de API key
- Resposta: `[{"query": "62.60.131.x", "country": "Portugal"}]`

## Protecoes

- Timeout de 5 segundos na chamada HTTP
- Limite de 100 IPs por batch
- Filtragem de IPs privados (nao consultar IPs internos)
- Fallback silencioso: se a API falhar, o processamento continua normalmente sem dados de pais (mesmo comportamento atual)
- Log de quantidade de IPs resolvidos para debug

## Resultado Esperado

- BR-PMP-FW-001 (e qualquer outro FortiOS 7.2 ou anterior) tera paises resolvidos automaticamente
- "Top Paises - Autenticacao" exibira dados de geolocalizacao corretamente
- Mapa de Ataques tera coordenadas para eventos de autenticacao
- Sem impacto no BAU-FW (ja tem paises nativos, GeoIP nao sera chamado)
- Latencia adicional: ~200ms apenas quando necessario

