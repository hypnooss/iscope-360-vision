
# Correcao da Data/Hora nas Alteracoes de Configuracao

## Problema Identificado

O FortiGate envia a data e hora em **campos separados**: `log.date` = `"2026-02-23"` e `log.time` = `"23:00:01"`. O codigo atual (linha 636 do `firewall-analyzer/index.ts`) usa apenas `log.date`, ignorando completamente o campo `time`.

Isso faz com que `new Date("2026-02-23")` seja interpretado como meia-noite UTC (`2026-02-23T00:00:00Z`), que no fuso horario do Brasil (UTC-3) aparece como **22/02/2026, 21:00:00** -- exatamente o que voce esta vendo.

## Solucao

**Arquivo:** `supabase/functions/firewall-analyzer/index.ts`

Alterar a linha 636 para combinar `log.date` + `log.time` antes de gerar o timestamp:

```text
// De:
date: log.date || log.eventtime || '',

// Para:
date: (log.date && log.time) ? `${log.date}T${log.time}` : log.date || log.eventtime || '',
```

Isso gera o valor `"2026-02-23T23:00:01"` que sera corretamente interpretado como horario local do firewall.

## Resultado Esperado

| Antes | Depois |
|---|---|
| 22/02/2026, 21:00:00 | 23/02/2026, 23:00:01 |

Uma unica linha alterada na edge function, sem mudancas no frontend.
