

## Adicionar botão de cancelar para snapshots do Analyzer com status pendente

### Situação atual
A página de Execuções já possui botões de cancelar para:
- **posture** (m365_posture_history) — pendente, running, partial
- **agent_task** (agent_tasks) — pendente, running

Porém, itens do tipo **analyzer_snapshot** (Edge Function) com status `pending` não têm botão de cancelar. Na screenshot, a linha "Edge Function / Pendente" mostra apenas o ícone de visualizar.

### Alterações

**Arquivo:** `src/pages/m365/M365ExecutionsPage.tsx`

1. **Adicionar estado e mutation para cancelar snapshots:**
   - Criar `snapshotCancelOpen` e `snapshotToCancel` states
   - Criar `cancelSnapshotMutation` que faz update na tabela `m365_analyzer_snapshots` setando `status = 'cancelled'` onde status é `pending` ou `processing`
   - Criar função `requestSnapshotCancel`

2. **Adicionar botão de cancelar na coluna Ações para `analyzer_snapshot`:**
   - Condição: `item.source === 'analyzer_snapshot' && ['pending', 'running'].includes(item.status)`
   - Mesmo padrão visual dos outros botões (ghost, icon Ban, text-destructive)

3. **Adicionar AlertDialog de confirmação para cancelar snapshot:**
   - Mesmo padrão dos diálogos existentes (cancelar análise/tarefa)
   - Título: "Cancelar análise do Analyzer?"

