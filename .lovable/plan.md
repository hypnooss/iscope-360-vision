

## Problema: Dados Duplicados no Exchange Analyzer

### Diagnóstico

O Firewall Analyzer usa janelas temporais consecutivas (`period_start` = `period_end` do último snapshot), garantindo que cada snapshot cubra um período sem sobreposição. O M365/Exchange Analyzer **não respeita essa janela** em 3 pontos:

1. **Blueprint PowerShell** — O comando `exo_message_trace` usa `-StartDate (Get-Date).AddHours(-24)` fixo, ignorando o `period_start` do payload da task. Se duas análises rodam com 2h de intervalo, ambas coletam as mesmas 24h, gerando sobreposição de 22h.

2. **Edge Function `m365-analyzer`** — As queries Graph API (`signInLogs`, `auditLogs`) usam `Date.now() - 24h` fixo em vez do `period_start`/`period_end` do snapshot.

3. **Frontend `useM365AnalyzerData.ts`** — Agrega até 720 snapshots somando contadores (`spamBlocked`, `malwareBlocked`, etc.) e fazendo merge de rankings. Com janelas sobrepostas, os mesmos eventos são contados múltiplas vezes.

### Plano de Correção

#### 1. Atualizar Blueprint no Banco de Dados

Alterar o comando `exo_message_trace` no blueprint `m365` (hybrid) para usar parâmetros dinâmicos do payload:

```text
Antes:  -StartDate (Get-Date).AddHours(-24) -EndDate (Get-Date)
Depois: -StartDate '{period_start}' -EndDate '{period_end}'
```

O `rpc_get_agent_tasks` já injeta `period_start`/`period_end` no payload. O agente precisa interpolá-los no comando. Verificar se o agente já suporta placeholders `{period_start}` no campo `command` (via `dynamic_params` do blueprint ou substituição direta no agent).

**Alternativa segura** (se o agent não suporta placeholders): Adicionar `period_start` e `period_end` como `params` no step do blueprint, e o agent já os recebe como parte dos params da task.

#### 2. Edge Function `m365-analyzer/index.ts`

Substituir as janelas fixas de 24h pelos valores do snapshot:

```ts
// Antes (linha ~2147):
const periodStartISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// Depois:
const periodStartISO = snapshot.period_start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const periodEndISO = snapshot.period_end || new Date().toISOString();
const periodFilter = `&$filter=createdDateTime ge ${periodStartISO} and createdDateTime le ${periodEndISO}`;
```

Aplicar em ambos os blocos (fallback Graph API ~linha 2147 e enriquecimento ~linha 2197).

#### 3. Frontend — Sem Mudança Necessária

A agregação no frontend (somar contadores, merge de rankings) é correta **quando os snapshots não se sobrepõem**. Uma vez que o backend passe a gerar snapshots com janelas consecutivas, a agregação produzirá resultados precisos sem duplicação.

### Resumo de Alterações

| Local | Alteração |
|-------|-----------|
| **DB Blueprint** (migration SQL) | Atualizar comando `exo_message_trace` para usar `period_start`/`period_end` do payload |
| **`supabase/functions/m365-analyzer/index.ts`** | Usar `snapshot.period_start`/`period_end` nas queries Graph API em vez de 24h fixo |
| **Deploy** | Redeployar edge function `m365-analyzer` |

