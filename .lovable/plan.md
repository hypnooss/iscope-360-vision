

# Fix: Normalizar eventtime em nanossegundos na Edge Function e no Agente

## Problema confirmado com logs reais

A execucao de 2026-02-24T21:46 do BAU-FW mostra que **100% dos logs foram descartados**:

```text
filterLogsByTime: 1500 -> 0 (removed 1500 outside window)
filterLogsByTime: 1032 -> 0 (removed 1032 outside window)
filterLogsByTime: 6 -> 0 (removed 6 outside window)
filterLogsByTime: 1500 -> 0 (removed 1500 outside window)
Completed: score=100, insights=0, critical=0
```

### Causa raiz

O `eventtime` do FortiGate BAU-FW esta em **nanossegundos** (ex: `1771969551897440000` = 1.77 x 10^18).

O codigo atual na linha 1032 de `firewall-analyzer/index.ts`:

```text
return et > 1e15 ? et / 1000 : et > 1e12 ? et : et * 1000;
```

Calculo com nanossegundos:
- `1.77e18 > 1e15` -> true -> divide por 1000
- Resultado: `1.77e15 ms` = ano ~58.000
- Janela valida: `2026-02-24T20:44 -> 21:44`
- Log do "ano 58.000" esta FORA da janela -> **descartado**

O correto seria dividir por `1e6` (nano -> milli), mas o codigo so divide por `1e3`.

## Solucao

### 1. Edge Function: `supabase/functions/firewall-analyzer/index.ts`

Corrigir `extractTimestampMs` (linha 1029-1040) para detectar nanossegundos:

```typescript
function extractTimestampMs(log: any): number | null {
  if (log.eventtime) {
    let et = Number(log.eventtime);
    if (et > 1e17) et = et / 1e6;       // nanoseconds -> ms
    else if (et > 1e14) et = et / 1e3;  // microseconds -> ms
    else if (et < 1e12) et = et * 1e3;  // seconds -> ms
    // else: already ms
    return et;
  }
  if (log.date) {
    const timeStr = log.time || '00:00:00';
    const parsed = new Date(`${log.date}T${timeStr}-03:00`);
    if (!isNaN(parsed.getTime())) return parsed.getTime();
  }
  return null;
}
```

| Valor de entrada | Magnitude | Antes (bugado) | Depois (corrigido) |
|---|---|---|---|
| `1.77e18` (ns) | > 1e17 | /1e3 = 1.77e15 ms (ano 58k) | /1e6 = 1.77e12 ms (2026 correto) |
| `1.77e15` (us) | > 1e14 | /1e3 = 1.77e12 ms (correto) | /1e3 = 1.77e12 ms (correto) |
| `1.77e12` (ms) | > 1e12 | mantido (correto) | mantido (correto) |
| `1.77e9` (s) | < 1e12 | *1e3 (correto) | *1e3 (correto) |

### 2. Python Agent: `python-agent/agent/executors/http_request.py`

Corrigir o filtro `is_in_window` (ja adicionado no plano anterior) para tambem detectar nanossegundos:

```python
def is_in_window(log):
    et = log.get('eventtime')
    if et:
        et_f = float(et)
        if et_f > 1e17:
            et_f = et_f / 1e9    # nanoseconds -> seconds
        elif et_f > 1e14:
            et_f = et_f / 1e6    # microseconds -> seconds
        elif et_f > 1e11:
            et_f = et_f / 1e3    # milliseconds -> seconds
        return et_f >= ps_epoch
    return True
```

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Corrigir `extractTimestampMs` para tratar nanossegundos (linha 1029-1040) |
| `python-agent/agent/executors/http_request.py` | Corrigir `is_in_window` para tratar nanossegundos (linha ~319) |

## Resultado esperado

Apos o fix, a mesma execucao produziria:

```text
filterLogsByTime: 1500 -> ~1500 (dentro da janela correta)
filterLogsByTime: 1032 -> ~1032 (dentro da janela correta)
Completed: score=XX, insights=Y, critical=Z
```

O dashboard exibira os dados normalmente.

