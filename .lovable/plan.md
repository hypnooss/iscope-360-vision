

## Problema: Agendamentos M365 Compliance sempre "Atrasado"

### Causa raiz

Bug de **escopo de variáveis** na função `processM365ComplianceSchedules` em `run-scheduled-analyses/index.ts`.

As variáveis `response` e `res` são declaradas com `const` **dentro** do bloco `else` (linhas 525/530), mas referenciadas **fora** dele na linha 541:

```text
if (!agentStatus.online) {
  // skip
} else {
  const response = ...   // ← escopo do else
  const res = ...        // ← escopo do else
}

// Fora do else → res e response NÃO EXISTEM aqui
if (!agentStatus.online || res?.success || response?.status === 409) {  // ← ReferenceError
  update next_run_at...
}
```

Quando o agent está **online**, a execução dispara com sucesso (as análises completam normalmente), mas ao chegar na linha 541, `res` e `response` não estão no escopo → **ReferenceError** → cai no `catch` → `next_run_at` **nunca é atualizado** → o schedule fica permanentemente "Atrasado".

### Solução

Refatorar para declarar `response` e `res` no escopo externo, movendo a lógica de avanço do `next_run_at` para dentro da estrutura correta:

```ts
let triggerSuccess = false;

if (!agentStatus.online) {
  console.log(`... Skipping: agent offline`);
  result.skipped++;
  triggerSuccess = true; // advance to avoid infinite retry
} else {
  const triggerUrl = `${supabaseUrl}/functions/v1/trigger-m365-posture-analysis`;
  const response = await fetch(triggerUrl, { ... });
  const res = await response.json();
  if (res.success || response.status === 409) {
    result.triggered++;
    triggerSuccess = true;
  } else {
    result.errors++;
  }
}

if (triggerSuccess) {
  await supabase.from('m365_compliance_schedules').update({ next_run_at: nextRunAt }).eq('id', schedule.id);
}
```

### Arquivo
- `supabase/functions/run-scheduled-analyses/index.ts` (linhas 518-545)

Requer deploy da edge function após a correção.

