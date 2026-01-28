

# Plano: Adicionar Constraint UNIQUE na Tabela task_step_results

## Problema Confirmado

Os logs das Edge Functions mostram o erro repetido:
```
Failed to insert step result: {
  code: "42P10",
  message: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
}
```

A Edge Function `agent-step-result` (linha 220) usa:
```typescript
.upsert({...}, { onConflict: 'task_id,step_id' })
```

Mas a tabela `task_step_results` **não possui** uma constraint UNIQUE em `(task_id, step_id)`.

## Solução

Adicionar a constraint UNIQUE via migração SQL:

```sql
ALTER TABLE task_step_results 
ADD CONSTRAINT task_step_results_task_id_step_id_unique 
UNIQUE (task_id, step_id);
```

## Resultado Esperado

Após a migração:
1. O `upsert` com `onConflict` funcionará corretamente
2. Os resultados dos steps serão salvos no banco
3. Se o mesmo step for enviado duas vezes, será atualizado ao invés de gerar erro
4. A análise do firewall será executada com sucesso

## Observação

A tarefa já está sendo marcada como concluída (vi nos logs do `agent-task-result`), mas os resultados individuais dos steps não estão sendo persistidos. Após a correção, todo o fluxo funcionará corretamente.

