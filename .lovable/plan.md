

# Fix: Timezone dos Config Changes do Firewall Analyzer

## Problema

Os horarios das alteracoes de configuracao estao sendo exibidos com **3 horas a menos** do que o horario real. Exemplo:
- Horario real (BRT): **18:04** e **18:29**
- Exibido na tela: **15:04** e **15:29**

## Causa raiz

No arquivo `supabase/functions/firewall-analyzer/index.ts`, existem dois pontos onde o timestamp do FortiGate (que esta em horario local BRT, UTC-3) eh tratado como UTC:

**Linha 636** — Construcao do campo `date` no configChangeDetails:
```text
date: `${log.date}T${log.time}`   // sem offset -> interpretado como UTC
```

**Linha 1291** — Persistencia no banco:
```text
changed_at: d.date ? new Date(d.date).toISOString() : ...
// new Date("2026-02-24T18:29:15") em Deno (UTC) -> "2026-02-24T18:29:15.000Z"
// Mas o horario real eh 18:29 BRT = 21:29 UTC
// O browser exibe em BRT: 18:29Z - 3h = 15:29 BRT (ERRADO)
```

A funcao `extractTimestampMs` (linha ~1035) ja aplica corretamente o offset `-03:00` para os mesmos campos `date`/`time`, mas o processamento de config changes nao faz o mesmo.

## Solucao

Adicionar o offset `-03:00` na construcao do timestamp na **linha 636**:

```text
// Antes:
date: (log.date && log.time) ? `${log.date}T${log.time}` : ...

// Depois:
date: (log.date && log.time) ? `${log.date}T${log.time}-03:00` : ...
```

Com isso, `new Date("2026-02-24T18:29:15-03:00").toISOString()` produzira `"2026-02-24T21:29:15.000Z"`, e o browser ao exibir em BRT mostrara corretamente **18:29**.

## Arquivo a alterar

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/firewall-analyzer/index.ts` | Adicionar offset `-03:00` na linha 636 |

## Nota

Apos o deploy, sera necessario re-executar uma coleta para que os novos registros tenham o timestamp correto. Os registros existentes na tabela `analyzer_config_changes` continuarao com o horario errado (3h a menos).

