

# Paginacao Completa no Firewall Analyzer - Todas as Coletas

## Problema

O blueprint do FortiGate Analyzer usa `rows=500` em todos os endpoints de coleta de logs em memoria. Quando o volume de eventos supera 500 em uma hora, os registros mais antigos da janela sao descartados silenciosamente. Isso afeta **todas** as coletas, nao apenas config changes:

- `denied_traffic` (trafico negado)
- `auth_events` (login administrativo)
- `vpn_events` (autenticacao VPN)
- `ips_events` (IPS/IDS)
- `config_changes` (alteracoes de configuracao)
- `webfilter_blocked` (web filter)
- `appctrl_blocked` (app control)
- `anomaly_events` (anomalias)
- `allowed_traffic` (trafico permitido)

## Estrategia de Solucao

### 1. Paginacao automatica no Agent Python

**Arquivo:** `python-agent/agent/executors/http_request.py`

Adicionar logica de paginacao automatica para endpoints FortiGate `/api/v2/log/memory/`:

- Detectar URLs que contenham `/api/v2/log/memory/` e o parametro `rows`
- Buscar paginas sucessivas via parametro `start` (1, 501, 1001, ...)
- Parar quando:
  - Pagina retorna menos registros que `rows`
  - Pagina vazia
  - Logs mais antigos que `period_start` (se disponivel no contexto)
  - Limite de seguranca `max_pages` (default: 20, ou seja, ate 10.000 registros)
- Agregar todos os `results` em um unico array retornado no mesmo formato

```text
Fluxo:
  Page 1: GET /api/v2/log/memory/traffic/forward?...&rows=500&start=0
  Page 2: GET /api/v2/log/memory/traffic/forward?...&rows=500&start=500
  Page 3: GET /api/v2/log/memory/traffic/forward?...&rows=500&start=1000
  ...ate criterio de parada
```

Metadados adicionados ao retorno para observabilidade:
- `_pagination.pages_fetched`
- `_pagination.total_records`
- `_pagination.stopped_by` (empty_page, partial_page, period_cutoff, max_pages)

### 2. Propagar period_start para o Agent

**Arquivo:** `supabase/functions/trigger-firewall-analyzer/index.ts`

Incluir `period_start` e `period_end` no payload da task para que o agent possa usar como criterio de parada da paginacao:

```text
payload: {
  firewall_name: firewall.name,
  device_type_id: firewall.device_type_id,
  snapshot_id: snapshot.id,
  period_start: periodStart,   // NOVO
  period_end: now,             // NOVO
}
```

**Arquivo:** `python-agent/agent/tasks.py`

Propagar `period_start` do payload da task para o `context` do executor:

```text
# Em _build_context ou no execute():
if payload.get('period_start'):
    context['period_start'] = payload['period_start']
```

### 3. Remover limite de 200 no configChangeDetails

**Arquivo:** `supabase/functions/firewall-analyzer/index.ts` (linha 640)

Remover o `.slice(0, 200)` que trunca os detalhes de alteracoes antes da persistencia.

Manter um limite seguro mais alto (ex: 2000) apenas como protecao contra payloads excessivos, ou inserir em lotes de 500 no banco.

### 4. Versao do Agent

**Arquivo:** `python-agent/agent/version.py`

Incrementar versao para refletir a nova capacidade de paginacao.

## Detalhes Tecnicos da Paginacao

A logica de paginacao sera implementada como metodo privado `_paginated_request` no `HTTPRequestExecutor`:

```text
def _paginated_request(self, step_id, method, url, headers, config, context):
    rows = extrair 'rows' da URL (regex)
    max_pages = config.get('max_pages', 20)
    period_start = context.get('period_start')
    
    all_results = []
    current_start = 0
    
    for page in range(max_pages):
        paged_url = substituir/adicionar start=current_start na URL
        response = requests.request(...)
        data = response.json()
        results = data.get('results', [])
        
        all_results.extend(results)
        
        if len(results) < rows:
            break  # partial_page
        if not results:
            break  # empty_page
        if period_start e log mais antigo < period_start:
            break  # period_cutoff
            
        current_start += rows
    
    return {
        'status_code': 200,
        'data': {'results': all_results, '_pagination': {...}},
        'error': None
    }
```

A deteccao e automatica: qualquer GET para `/api/v2/log/memory/` que contenha `rows=` sera paginado. Endpoints que nao sejam de log (compliance, system status) nao sao afetados.

## Resultado Esperado

| Cenario | Antes | Depois |
|---|---|---|
| Config changes (>500 eventos/h) | Perda de registros fora do lote de 500 | Coleta completa com paginacao |
| Denied traffic (alto volume) | Apenas 500 mais recentes | Todos da janela |
| IPS events (surto de alertas) | Truncado a 500 | Completo |
| Persistencia de config changes | Limitado a 200 | Sem limite artificial |

## Sequencia de Implementacao

1. Paginacao no `http_request.py` (agent)
2. Propagacao de `period_start` no trigger e no `tasks.py`
3. Remocao do `.slice(0, 200)` na edge function
4. Bump de versao do agent
5. Deploy das edge functions

