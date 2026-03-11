

## Fallback de Endpoints: Memory → Disk para FortiGate Analyzer

### Problema
Firewalls com log em memória desativado retornam dados vazios nos endpoints `/api/v2/log/memory/...`. O sistema precisa tentar automaticamente os endpoints equivalentes em `/api/v2/log/disk/...`.

### Solução

Dois pontos de alteração:

**1. Blueprint (banco de dados)** — Adicionar `fallback_path` em cada step de log do blueprint "FortiGate - Analyzer":

| Step ID | Path atual (memory) | fallback_path (disk) |
|---|---|---|
| denied_traffic | `/api/v2/log/memory/traffic/forward?filter=action==deny&rows=500&extra=country_id` | `/api/v2/log/disk/traffic/forward?filter=action==deny&rows=500&extra=country_id` |
| auth_events | `/api/v2/log/memory/event/system?filter=subtype==system&rows=500&extra=country_id` | `/api/v2/log/disk/event/system?filter=subtype==system&rows=500&extra=country_id` |
| vpn_events | `/api/v2/log/memory/event/vpn?filter=subtype==vpn&rows=500&extra=country_id` | `/api/v2/log/disk/event/vpn?filter=subtype==vpn&rows=500&extra=country_id` |
| ips_events | `/api/v2/log/memory/ips?rows=500` | `/api/v2/log/disk/ips?rows=500` |
| config_changes | `/api/v2/log/memory/event/system/?filter=subtype==system&rows=500` | `/api/v2/log/disk/event/system/?filter=subtype==system&rows=500` |
| webfilter_blocked | `/api/v2/log/memory/webfilter?filter=action==blocked&rows=500` | `/api/v2/log/disk/webfilter?filter=action==blocked&rows=500` |
| appctrl_blocked | `/api/v2/log/memory/app-ctrl?filter=action==block&rows=500` | `/api/v2/log/disk/app-ctrl?filter=action==block&rows=500` |
| anomaly_events | `/api/v2/log/memory/anomaly?rows=500&extra=country_id` | `/api/v2/log/disk/anomaly?rows=500&extra=country_id` |
| allowed_traffic | `/api/v2/log/memory/traffic/forward?filter=action==accept&rows=500&extra=country_id` | `/api/v2/log/disk/traffic/forward?filter=action==accept&rows=500&extra=country_id` |

Os steps de monitor (`monitor_firewall_policy`, `monitor_firewall_session`, `monitor_traffic_history`, `monitor_botnet_domains`) **não** precisam de fallback — são endpoints de estado real-time, não de log.

**2. Agent Python (`python-agent/agent/executors/http_request.py`)** — Adicionar lógica de fallback:
- Após executar o request principal (memory), se o resultado retornar **0 registros** (results vazio) e o step tiver `fallback_path` configurado, repetir o request usando o `fallback_path`
- Logar qual path foi usado (memory vs disk) para rastreabilidade
- A paginação automática já existente se aplica igualmente aos endpoints de disk (mesma estrutura de resposta)
- O pattern `_MEMORY_LOG_PATTERN` precisa ser expandido para incluir `/api/v2/log/disk/` para que a paginação funcione nos endpoints de fallback

**3. Atualizar o regex de paginação** no `http_request.py`:
- De: `r'/api/v2/log/memory/'`
- Para: `r'/api/v2/log/(memory|disk)/'`

### Arquivos a modificar
- `python-agent/agent/executors/http_request.py` — fallback logic + regex update
- Migration SQL — UPDATE no blueprint para adicionar `fallback_path` nos steps

### Fluxo
```text
Agent recebe step com:
  path: /api/v2/log/memory/event/system?...
  fallback_path: /api/v2/log/disk/event/system?...

1. Executa GET memory → results: []
2. fallback_path existe? Sim → Executa GET disk
3. Retorna resultado do disk (ou memory se tinha dados)
```

