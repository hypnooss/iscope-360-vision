

## Problema: Snapshot do Surface Analyzer fica "Pendente" e nunca muda para "Executando"

### Diagnóstico

No fluxo `run-attack-surface-queue`, o snapshot é criado com `status: 'pending'` (linha 306). Após criar as tasks, **nenhuma atualização de status é feita**. A transição para `running` só ocorre em `attack-surface-step-result` — quando a primeira task **termina** — pulando direto de "Pendente" para parcialmente completo.

Ou seja, enquanto o Agent está processando as tasks, o snapshot permanece "Pendente" na tela de Execuções.

### Solução

**1. `supabase/functions/run-attack-surface-queue/index.ts`**
- Após criar as tasks com sucesso (linha 334), atualizar o snapshot para `status: 'running'`:
```ts
await supabase
  .from('attack_surface_snapshots')
  .update({ status: 'running' })
  .eq('id', snapshot.id)
```

**2. `supabase/functions/attack-surface-step-result/index.ts`** (linha 77-82)
- A lógica atual já faz `update({ status: 'running' }).eq('status', 'pending')` — isso continua funcionando como fallback sem conflito.

### Arquivos
- `supabase/functions/run-attack-surface-queue/index.ts` — adicionar update após criação das tasks
- Deploy da edge function atualizada

