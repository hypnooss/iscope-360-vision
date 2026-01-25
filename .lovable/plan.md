
# Cancelamento de Tarefas em Execução

## Situação Atual

### Tarefa Encontrada
Uma tarefa `fortigate_compliance` está em execução:
- **ID**: `baa5e084-6170-49ec-be36-731bf7394a33`
- **Status**: `running`
- **Iniciada**: 25/01/2026 16:53:33 UTC
- **Expira em**: 25/01/2026 17:53:25 UTC

### Código Existente
A página já tem um `cancelMutation` implementado, mas:
- Só permite cancelar tarefas com status `pending`
- Tarefas `running` não mostram o botão de cancelar

## Alterações Necessárias

### 1. Cancelar a Tarefa Atual (Database)
Atualizar a tarefa `baa5e084-6170-49ec-be36-731bf7394a33` para status `cancelled`:

```sql
UPDATE agent_tasks
SET 
  status = 'cancelled',
  completed_at = NOW(),
  error_message = 'Cancelada manualmente pelo administrador'
WHERE id = 'baa5e084-6170-49ec-be36-731bf7394a33';
```

### 2. Expandir o Botão de Cancelar (src/pages/firewall/TaskExecutionsPage.tsx)

**Linha 139-149** - Atualizar o `cancelMutation` para aceitar tarefas `pending` OU `running`:

```typescript
const cancelMutation = useMutation({
  mutationFn: async (taskId: string) => {
    const { error } = await supabase
      .from('agent_tasks')
      .update({ 
        status: 'cancelled', 
        completed_at: new Date().toISOString(),
        error_message: 'Cancelada pelo usuário'
      })
      .eq('id', taskId)
      .in('status', ['pending', 'running']); // Permite cancelar pending e running
    
    if (error) throw error;
  },
  ...
});
```

**Linhas 398-407** - Mostrar o botão para tarefas `pending` OU `running`:

```typescript
{(task.status === 'pending' || task.status === 'running') && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => cancelMutation.mutate(task.id)}
    disabled={cancelMutation.isPending}
    title="Cancelar tarefa"
  >
    <Ban className="w-4 h-4 text-destructive" />
  </Button>
)}
```

## Comportamento Final

| Status | Botão Cancelar |
|--------|----------------|
| `pending` | ✅ Visível |
| `running` | ✅ Visível |
| `completed` | ❌ Oculto |
| `failed` | ❌ Oculto |
| `timeout` | ❌ Oculto |
| `cancelled` | ❌ Oculto |

## Considerações Técnicas

### Limitação do Cancelamento de Tarefas "Running"
Cancelar uma tarefa com status `running` no banco de dados **não interrompe a execução** no agent Python. O agent continuará executando a tarefa até concluir, mas quando tentar reportar o resultado, a tarefa já estará marcada como `cancelled` e o resultado será ignorado.

Para uma interrupção real do agent seria necessário:
1. Implementar um mecanismo de "cancellation token" no agent
2. O agent verificar o status da tarefa periodicamente durante a execução

A implementação proposta é suficiente para a maioria dos casos de uso - evita que resultados de tarefas canceladas sejam processados e dá feedback visual ao usuário.
