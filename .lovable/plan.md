

# Plano: Adicionar Botão de Cancelar Tasks M365

## Contexto

A página de Execuções M365 já exibe as tasks PowerShell, mas não permite cancelar tasks que estão em execução ou pendentes. Outras páginas do sistema (External Domain Executions, Firewall Task Executions) já possuem essa funcionalidade implementada.

---

## Solução

Replicar o padrão de cancelamento de tasks já existente no projeto para a aba **Tasks PowerShell** da página `M365ExecutionsPage`.

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/m365/M365ExecutionsPage.tsx` | Adicionar funcionalidade de cancelamento de tasks |

---

## Mudanças Detalhadas

### 1. Novos Imports

Adicionar imports necessários:
- `useMutation`, `useQueryClient` do `@tanstack/react-query`
- `AlertDialog` e componentes relacionados do `@/components/ui/alert-dialog`
- `Ban` icon do `lucide-react`
- `toast` do `sonner`

### 2. Novos Estados

```typescript
const [cancelOpen, setCancelOpen] = useState(false);
const [taskToCancel, setTaskToCancel] = useState<AgentTask | null>(null);
const queryClient = useQueryClient();
```

### 3. Mutation de Cancelamento

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
      .in('status', ['pending', 'running']);
    
    if (error) throw error;
  },
  onSuccess: async () => {
    toast.success('Tarefa cancelada com sucesso');
    await queryClient.invalidateQueries({ queryKey: ['m365-agent-tasks'] });
    
    // Atualiza detalhes abertos se for a mesma task
    setSelectedTask(prev => {
      if (!prev || prev.id !== taskToCancel?.id) return prev;
      return {
        ...prev,
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error_message: prev.error_message || 'Cancelada pelo usuário'
      };
    });
    setCancelOpen(false);
    setTaskToCancel(null);
  },
  onError: (e: any) => {
    toast.error('Erro ao cancelar tarefa', { description: e?.message });
  }
});

const requestCancel = (task: AgentTask) => {
  setTaskToCancel(task);
  setCancelOpen(true);
};
```

### 4. Botão de Cancelar na Tabela de Tasks

Na coluna "Ações" da tabela de Tasks PowerShell, adicionar botão de cancelar:

```typescript
<TableCell className="text-right flex items-center justify-end gap-1">
  {(task.status === 'pending' || task.status === 'running') && (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => requestCancel(task)}
      disabled={cancelMutation.isPending}
      title="Cancelar tarefa"
    >
      <Ban className="w-4 h-4 text-destructive" />
    </Button>
  )}
  <Button variant="ghost" size="icon" onClick={() => openTaskDetails(task)}>
    <Eye className="w-4 h-4" />
  </Button>
</TableCell>
```

### 5. Dialog de Confirmação

Adicionar no final do componente, antes do fechamento de `</div>`:

```typescript
<AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Encerrar execução?</AlertDialogTitle>
      <AlertDialogDescription>
        Isso marcará a tarefa como <span className="font-medium">cancelada</span>. 
        Se o agent já estiver executando, ele pode ainda terminar o step atual, 
        mas a execução ficará registrada como encerrada.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setTaskToCancel(null)}>
        Voltar
      </AlertDialogCancel>
      <AlertDialogAction
        onClick={() => {
          if (!taskToCancel) return;
          cancelMutation.mutate(taskToCancel.id);
        }}
        disabled={!taskToCancel || cancelMutation.isPending}
      >
        {cancelMutation.isPending ? 'Encerrando...' : 'Encerrar'}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## UI Esperada

Na tabela de Tasks PowerShell, ao lado do botão de visualizar (olho), aparecerá um botão vermelho de cancelar para tasks com status `pending` ou `running`:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Tenant       │ Agente       │ Tipo       │ Status     │ Duração │ Ações   │
├───────────────────────────────────────────────────────────────────────────┤
│ BRASILUX ... │ TASCHIBRA-ID │ PowerShell │ Executando │ 7.2m    │ 🚫 👁   │
└───────────────────────────────────────────────────────────────────────────┘
                                                          ↑    ↑
                                                     Cancelar  Ver
```

Ao clicar em cancelar, aparece diálogo de confirmação.

---

## Resultado Esperado

1. Botão de cancelar (ícone `Ban`) aparece em tasks com status `pending` ou `running`
2. Ao clicar, abre diálogo de confirmação
3. Ao confirmar, task é atualizada para `status = 'cancelled'`
4. Toast de sucesso/erro é exibido
5. Lista é automaticamente recarregada
6. Se o diálogo de detalhes estiver aberto, o status é atualizado em tempo real

