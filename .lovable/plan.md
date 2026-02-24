
# Correcao do Desalinhamento de Timezone (UTC vs BRT)

## Problema

Os logs do FortiGate usam horario local (BRT, UTC-3) nos campos `date` e `time`. O sistema define `period_start`/`period_end` em UTC. Ao comparar diretamente, ha um deslocamento de 3 horas que faz logs legitimos serem descartados.

Exemplo: config change as 16:54 BRT = 19:54 UTC, mas o parser interpreta como 16:54 UTC, ficando fora da janela `[19:00 UTC, 20:00 UTC)`.

## Alteracoes

### 1. Edge Function `firewall-analyzer/index.ts`

Alterar `extractTimestampMs` (linha 1029) para tratar `date`+`time` como horario local BRT (`-03:00`):

```text
// De:
const parsed = new Date(`${log.date}T${timeStr}`);

// Para:
const parsed = new Date(`${log.date}T${timeStr}-03:00`);
```

Isso converte corretamente para UTC ao criar o objeto Date.

### 2. Agent Python `http_request.py`

Alterar a comparacao de cutoff (linhas 224-240) para priorizar `eventtime` (epoch, sem ambiguidade de timezone). Para o fallback `date`+`time`, converter para UTC adicionando offset `-03:00` antes de comparar com `period_start` (que ja esta em UTC):

```text
# Priorizar eventtime (epoch Unix)
if oldest_log.get('eventtime'):
    from datetime import datetime, timezone
    et = float(oldest_log['eventtime'])
    # Normalizar para segundos
    if et > 1e15: et = et / 1e6
    elif et > 1e12: et = et / 1e3
    ps_dt = datetime.fromisoformat(period_start.replace('Z', '+00:00'))
    if et < ps_dt.timestamp():
        stopped_by = 'period_cutoff'
        break
else:
    # Fallback: date+time como BRT, converter para UTC para comparar
    ...
```

**Sem bump de versao** -- aplicacao manual no agente.

## Arquivos a Alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | `extractTimestampMs`: parsear `date+time` com offset `-03:00` |
| `python-agent/agent/executors/http_request.py` | Comparacao de cutoff: usar `eventtime` epoch, fallback com offset |

## Resultado Esperado

| Cenario | Antes | Depois |
|---|---|---|
| Config change 16:54 BRT | Parseado como 16:54 UTC, fora da janela | Parseado como 19:54 UTC, dentro da janela |
| Cutoff no agent | Compara string local vs UTC (3h erro) | Compara epoch vs epoch (correto) |
| Logs com `eventtime` | Ja funciona (epoch e UTC) | Sem alteracao |
