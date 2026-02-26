

## Correção: Adicionar handler m365_analyzer no agent-task-result

### Problema identificado

O agent completa a task `m365_analyzer` com sucesso, mas o snapshot permanece `pending` porque a edge function `agent-task-result` nao possui handler para o tipo `m365_analyzer`. Sem esse handler, a edge function `m365-analyzer` (que processa os dados e atualiza o snapshot) nunca e invocada.

### Solucao

Adicionar um bloco de processamento em `supabase/functions/agent-task-result/index.ts`, logo apos o handler do `fortigate_analyzer` (linha ~4318), seguindo o mesmo padrao:

```
if ((body.status === 'completed' || body.status === 'partial') 
    && task.task_type === 'm365_analyzer' && rawData) {
  const taskPayload = task.payload;
  const snapshotId = taskPayload?.snapshot_id;

  if (snapshotId) {
    // Chama a edge function m365-analyzer para processar os dados
    const analyzerUrl = `${supabaseUrl}/functions/v1/m365-analyzer`;
    const response = await fetch(analyzerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ snapshot_id: snapshotId, task_id: body.task_id, raw_data: rawData }),
    });
    // Log resultado
  } else {
    // Se nao tem snapshot_id, marcar snapshot como failed
  }
}
```

### Arquivo impactado

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Adicionar bloco handler para `m365_analyzer` (~20 linhas, apos linha 4318) |

### Apos o deploy

O snapshot atual (`a52bc061`) que esta preso em `pending` precisara ser manualmente atualizado para `failed` ou removido, ja que os dados da task original ja foram descartados. A proxima execucao de analise funcionara corretamente com o handler implementado.

