

## Plano: Exibir snapshots do M365 Analyzer na tela de Execuções (paridade com Compliance)

### Problema

A tela de Execuções do M365 mostra duas fontes:
- `m365_posture_history` → Compliance (Edge Function)
- `agent_tasks` → Compliance (Agent) e Analyzer (Agent)

Os `m365_analyzer_snapshots` (criados pelo `trigger-m365-analyzer` e atualizados pelas Edge Functions de dashboard) **não aparecem** na lista. Resultado: o Analyzer mostra apenas a perna do Agent, enquanto o Compliance mostra Agent + Edge Function.

### Solução

Adicionar `m365_analyzer_snapshots` como terceira fonte de dados na tela de Execuções, exibindo-os como "M365 Analyzer" com origem "Edge Function" — espelhando o comportamento do Compliance.

### Mudanças em `src/pages/m365/M365ExecutionsPage.tsx`

#### 1. Nova query para `m365_analyzer_snapshots`

Adicionar uma terceira query (similar à de `m365_posture_history`):

```tsx
const { data: analyzerSnapshots = [], refetch: refetchSnapshots } = useQuery({
  queryKey: ['m365-analyzer-snapshots', statusFilter, timeFilter, workspaceIds],
  queryFn: async () => {
    const startTime = getTimeFilterDate();
    let query = supabase
      .from('m365_analyzer_snapshots')
      .select('id, tenant_record_id, client_id, status, score, summary, insights, period_start, period_end, agent_task_id, created_at')
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);
    if (workspaceIds?.length) query = query.in('client_id', workspaceIds);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
});
```

#### 2. Expandir `UnifiedExecution` e merge

- Adicionar `source: 'analyzer_snapshot'` ao tipo
- Mapear snapshots para `UnifiedExecution` com `type: 'm365_graph_api'` (já mapeado como "M365 Analyzer") e `agentId: null`
- Incluir no merge/sort

#### 3. Atualizar coluna "Agent"

Na renderização da tabela, tratar `source === 'analyzer_snapshot'` mostrando "Edge Function" (como já faz para `posture_analysis`).

#### 4. Atualizar `handleRefresh`

Incluir `refetchSnapshots()`.

#### 5. Dialog de detalhes para snapshots

Adicionar um dialog simples para exibir os dados do snapshot (score, summary, período, insights) quando o usuário clicar em "Ver detalhes".

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/pages/m365/M365ExecutionsPage.tsx` | Adicionar query, merge e dialog para analyzer snapshots |

