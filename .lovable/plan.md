

## Problema

O `useAnalyzerProgress` verifica apenas o `analyzer_snapshots.status`. Quando as `agent_tasks` são marcadas como `timeout`, os snapshots correspondentes permanecem `pending` — e a barra de progresso continua visível.

O timeout de 60 minutos adicionado anteriormente não ajuda aqui porque o snapshot tem apenas ~29 minutos (ainda dentro do limite).

## Correções

### 1. Hook `useAnalyzerProgress` — cross-check com agent_task
**Arquivo:** `src/hooks/useAnalyzerData.ts` (linhas 289-317)

Após buscar o snapshot `pending`/`processing`, verificar o status da `agent_task` associada. Se a task já está `timeout`/`failed`/`completed`, tratar o snapshot como encerrado:

```typescript
// Após obter o snapshot pendente/processing, verificar a task associada
if (snap.agent_task_id) {
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('status')
    .eq('id', snap.agent_task_id)
    .maybeSingle();
  
  if (task && ['timeout', 'failed', 'completed'].includes(task.status)) {
    // Atualizar o snapshot para refletir a task (fire-and-forget)
    supabase.from('analyzer_snapshots').update({ status: 'failed' })
      .eq('id', snap.id).then(() => {});
    return { status: 'timeout', elapsed: null };
  }
}
```

### 2. Edge Function cleanup — sincronizar snapshots com tasks encerradas
**Arquivo:** `supabase/functions/cleanup-expired-tasks/index.ts`

Após marcar tasks como `timeout`, adicionar um passo que atualiza os `analyzer_snapshots` cujo `agent_task_id` corresponda a uma task encerrada:

```typescript
// 5. Sync snapshots whose agent_task is already done
await supabase.rpc('raw_sql', { query: `
  UPDATE analyzer_snapshots s
  SET status = 'failed'
  FROM agent_tasks t
  WHERE s.agent_task_id = t.id
    AND s.status IN ('pending', 'processing')
    AND t.status IN ('timeout', 'failed')
` });
```

Nota: se `rpc raw_sql` não existe, usar queries diretas buscando os IDs das tasks afetadas.

### 3. Correção imediata no banco
SQL para executar agora no Supabase Dashboard:

```sql
UPDATE analyzer_snapshots s
SET status = 'failed'
FROM agent_tasks t
WHERE s.agent_task_id = t.id
  AND s.status IN ('pending', 'processing')
  AND t.status IN ('timeout', 'failed');
```

### Resumo
- Hook faz cross-check: se a task já encerrou, o snapshot é tratado como expirado
- Cleanup periódico sincroniza snapshots órfãos
- SQL manual resolve o passivo atual

