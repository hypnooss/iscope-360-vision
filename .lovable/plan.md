
# Fix: Analyzer de Firewall - Paths de API Incorretos e Enriquecimento de Dados

## Problemas Identificados

### 1. Paths UTM incorretos (HTTP 404 em TODAS as execucoes)
Os logs das ultimas 3 tarefas confirmam:
```
webfilter_blocked: HTTP 404: Not Found
appctrl_blocked: HTTP 404: Not Found
```

**Causa**: O blueprint usa `/api/v2/log/memory/utm/webfilter` e `/api/v2/log/memory/utm/app-ctrl`, mas a API do FortiOS (tanto 7.2 quanto 7.4) **nao possui** o segmento `/utm/`. Os endpoints corretos sao:
- `/api/v2/log/memory/webfilter` (tipo UTM e diretamente sob `/memory/`)
- `/api/v2/log/memory/app-ctrl`

### 2. IPS intermitente (HTTP 500 em algumas versoes)
O endpoint `/api/v2/log/memory/ips` retorna 500 em certos FortiGates (ja conhecido e marcado como `optional: true`). Sem alteracao necessaria.

### 3. Enriquecimento de pais ausente no trafego negado
A API suporta o parametro `extra=country_id` (presente em ambas versoes 7.2 e 7.4) que adiciona o campo `srccountry` diretamente nos logs de trafego. Atualmente o blueprint nao usa esse parametro, resultando em dados de geolocalizacao incompletos no Mapa de Ataques.

## Solucao

### Correcao no Blueprint (banco de dados)

Atualizar os `collection_steps` do blueprint "FortiGate - Analyzer" com os paths corretos:

| Step | Path Atual (ERRADO) | Path Correto |
|---|---|---|
| `webfilter_blocked` | `/api/v2/log/memory/utm/webfilter?filter=action==blocked&rows=500` | `/api/v2/log/memory/webfilter?filter=action==blocked&rows=500` |
| `appctrl_blocked` | `/api/v2/log/memory/utm/app-ctrl?filter=action==block&rows=500` | `/api/v2/log/memory/app-ctrl?filter=action==block&rows=500` |
| `denied_traffic` | `/api/v2/log/memory/traffic/forward?filter=action==deny&rows=500` | `/api/v2/log/memory/traffic/forward?filter=action==deny&rows=500&extra=country_id` |

Os steps `denied_traffic` e UTM tambem recebem ajustes para melhorar a qualidade dos dados de geolocalizacao.

### Execucao

Um `UPDATE` no registro do blueprint no banco de dados para corrigir o JSON dos `collection_steps`. Nao ha alteracao em codigo frontend ou edge functions -- o processamento ja esta preparado para receber os dados de webfilter e app-ctrl.

### Apos a correcao

Os agents precisarao buscar novas tarefas (o blueprint e lido pelo RPC `rpc_get_agent_tasks` no momento da distribuicao). Na proxima execucao de analise, os steps de Web Filter e App Control retornarao dados reais em vez de 404.

## Resultado esperado

- Web Filter e App Control preenchidos no dashboard (Top Categorias, Top Usuarios)
- Mapa de Ataques com dados de geolocalizacao mais ricos (campo `srccountry` vindo direto da API)
- Tasks de Analyzer deixarao de falhar com 404
- Score de risco mais preciso (inclui insights de UTM como malware, botnets, P2P)
