

# Correcao: Snapshot travado em "pending" apos cancelamento de task

## Problema

Quando o usuario cancela uma task na pagina de Execucoes, apenas a `agent_tasks` e atualizada para `cancelled`. O `analyzer_snapshots` associado permanece em `status: pending`, fazendo com que a interface do Analyzer Dashboard mostre indefinidamente "Analise em andamento...".

Alem disso, o hook `useAnalyzerProgress` so reconhece `completed` e `failed` como estados finais -- `cancelled` nao e tratado.

## Correcao imediata (dados no banco)

O snapshot `96c404d9-2061-459d-a792-417a9bd76a2d` precisa ser atualizado para `cancelled`. Isso sera feito via a logica do cancelamento corrigida.

**Acao manual necessaria**: Atualizar diretamente no Supabase Dashboard:
```sql
UPDATE analyzer_snapshots SET status = 'cancelled' WHERE id = '96c404d9-2061-459d-a792-417a9bd76a2d';
```

## Alteracoes no codigo

### 1. `src/pages/firewall/TaskExecutionsPage.tsx` (cancelMutation)

Apos cancelar a `agent_tasks`, tambem atualizar o `analyzer_snapshots` associado:

```text
// Dentro do cancelMutation.mutationFn, apos o update da agent_tasks:

// Tambem cancelar o snapshot associado (se existir)
await supabase
  .from('analyzer_snapshots')
  .update({ status: 'cancelled' })
  .eq('agent_task_id', taskId)
  .in('status', ['pending', 'processing']);
```

### 2. `src/hooks/useAnalyzerData.ts` (useAnalyzerProgress)

Adicionar `cancelled` como estado final reconhecido (linha 265):

```text
// De:
if (snap.status === 'completed' || snap.status === 'failed') {

// Para:
if (snap.status === 'completed' || snap.status === 'failed' || snap.status === 'cancelled') {
```

### 3. Mesma correcao nos outros pontos de cancelamento

Aplicar a mesma propagacao para snapshot nos cancelamentos em:
- `src/pages/m365/M365ExecutionsPage.tsx`
- `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`

(Nesses casos, o snapshot pode nao existir, mas o update com filtro `eq('agent_task_id', taskId)` simplesmente nao afeta nenhuma linha.)

## Arquivos a alterar

| Arquivo | Alteracao |
|---|---|
| `src/pages/firewall/TaskExecutionsPage.tsx` | cancelMutation: propagar cancelamento para analyzer_snapshots |
| `src/hooks/useAnalyzerData.ts` | useAnalyzerProgress: reconhecer `cancelled` como estado final |
| `src/pages/m365/M365ExecutionsPage.tsx` | cancelMutation: propagar cancelamento para snapshots |
| `src/pages/external-domain/ExternalDomainExecutionsPage.tsx` | cancelMutation: propagar cancelamento para snapshots |

## Resultado esperado

- Cancelar task tambem cancela o snapshot associado
- Interface do Analyzer para de mostrar "Em andamento" apos cancelamento
- Snapshot `96c404d9` precisa ser corrigido manualmente no banco (UPDATE direto)
