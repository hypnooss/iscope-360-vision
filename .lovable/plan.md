

# Correcao: Filtrar config_changes no agente por cfgpath

## Problema

O step `config_changes` coleta TODOS os eventos `subtype==system` do FortiGate, que incluem logins, VPN status, heartbeats e muito mais. No BAU-FW, isso gera ~370 eventos/min. Em uma janela de 1 hora, sao ~22.000 eventos, truncados para 1.500 (cobrindo apenas ~4 min). Alteracoes de configuracao reais (com `cfgpath`) sao uma fracao minima desses logs e acabam perdidas na truncagem.

A edge function ja filtra por `cfgpath`, mas esse filtro acontece APOS a truncagem no agente -- tarde demais.

## Solucao

Duas alteracoes complementares no agente Python:

### 1. Filtro pos-coleta por `cfgpath` no step config_changes

No metodo `_paginated_request` (ou no processamento pos-coleta em `tasks.py`), para o step `config_changes`, manter apenas logs que possuam o campo `cfgpath` preenchido. Isso reduz drasticamente o volume antes da truncagem.

**Estimativa de impacto**: de ~22.000 logs para provavelmente ~50-200 (apenas alteracoes reais de configuracao). Muito abaixo do limite de 1.500.

**Arquivo: `python-agent/agent/tasks.py`**

Apos a execucao do step e antes de `_report_step_result`, adicionar logica de filtragem para steps especificos:

```python
# Apos executar o step, antes de reportar:
if step_id == 'config_changes' and step_data and isinstance(step_data, dict):
    results = step_data.get('results', [])
    if isinstance(results, list):
        original_count = len(results)
        # Keep only logs with cfgpath (real config changes)
        filtered = [log for log in results if isinstance(log, dict) and log.get('cfgpath')]
        step_data = dict(step_data)
        step_data['results'] = filtered
        step_data['_pre_filtered'] = True
        step_data['_pre_filter_original'] = original_count
        self.logger.info(
            f"Step {step_id}: Pre-filtered config_changes: "
            f"{original_count} -> {len(filtered)} (kept only cfgpath logs)"
        )
```

### 2. Filtro temporal pre-truncagem (complementar, para todos os steps)

Manter tambem a correcao original proposta: filtrar por `period_start` antes da truncagem. Isso beneficia outros steps de alto volume como `auth_events` e `vpn_events`, mesmo que nao resolva config_changes sozinho.

**Arquivo: `python-agent/agent/executors/http_request.py`**

No metodo `_paginated_request`, apos o loop de paginacao e antes de `_trim_log_fields`:

```python
# Filter logs outside the time window BEFORE truncation
if period_start and all_results:
    from datetime import datetime
    ps_dt = datetime.fromisoformat(period_start.replace('Z', '+00:00'))
    ps_epoch = ps_dt.timestamp()
    original_count = len(all_results)
    
    def is_in_window(log):
        et = log.get('eventtime')
        if et:
            et_f = float(et)
            if et_f > 1e15:
                et_f = et_f / 1e6
            elif et_f > 1e12:
                et_f = et_f / 1e3
            return et_f >= ps_epoch
        return True  # keep if no timestamp
    
    all_results = [log for log in all_results if is_in_window(log)]
    
    if len(all_results) != original_count:
        self.logger.info(
            f"Step {step_id}: Time filter: {original_count} -> {len(all_results)} "
            f"(removed {original_count - len(all_results)} outside window)"
        )
```

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `python-agent/agent/tasks.py` | Filtro por `cfgpath` para step `config_changes` antes de `_report_step_result` |
| `python-agent/agent/executors/http_request.py` | Filtro temporal por `period_start` apos coleta paginada, antes de `_trim_log_fields` |

## Resultado esperado no cenario do usuario

| Etapa | Antes | Depois |
|---|---|---|
| Coleta (1h, config_changes) | 22.000 eventos system | 22.000 (sem mudanca) |
| Filtro cfgpath (NOVO) | N/A | ~50-200 (so config reais) |
| Truncagem 1.500 | 22.000 -> 1.500 (perde 93%) | ~200 (sem truncagem necessaria) |
| Edge function recebe | 1.500 (maioria lixo) | ~200 (todos relevantes) |
| Alteracao das 17:03 | PERDIDA | PRESERVADA |

## Nota sobre escopo

Esta alteracao afeta apenas o step `config_changes`. Os outros steps de alto volume (`auth_events`, `vpn_events`) se beneficiam do filtro temporal (item 2), mas podem precisar de filtros similares especificos no futuro se a truncagem causar perda de dados relevantes nesses contextos.

