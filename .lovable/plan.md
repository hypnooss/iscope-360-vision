

# Corrigir exibicao de dados parciais durante scan em andamento

## Problema

O hook `useRunningAttackSurfaceSnapshot` busca o snapshot com status `running`, mas esse snapshot tem `results: {}` (vazio). Os resultados parciais de cada IP ficam armazenados na tabela `attack_surface_tasks` (campo `result`), e so sao consolidados no campo `results` do snapshot quando o scan inteiro termina. Por isso, mesmo com 10+ IPs ja processados, a pagina mostra "Nenhum dado disponivel".

## Solucao

Modificar o hook `useRunningAttackSurfaceSnapshot` para, alem de buscar o snapshot running, tambem buscar os resultados parciais da tabela `attack_surface_tasks` e montar um snapshot virtual com esses dados.

## Detalhes tecnicos

### Arquivo a modificar

`src/hooks/useAttackSurfaceData.ts`

### Mudanca no `useRunningAttackSurfaceSnapshot`

Apos buscar o snapshot running, fazer uma segunda query para buscar as tasks completadas desse snapshot e montar o campo `results` a partir delas:

```typescript
export function useRunningAttackSurfaceSnapshot(clientId?: string, enabled = true) {
  return useQuery({
    queryKey: ['attack-surface-running', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      // 1. Buscar snapshot running/pending
      const { data, error } = await (supabase
        .from('attack_surface_snapshots' as any)
        .select('*')
        .eq('client_id', clientId)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(1) as any);
      if (error) throw error;
      const rows = (data as any[]) || [];
      if (rows.length === 0) return null;

      const snap = parseSnapshot(rows[0] as Record<string, unknown>);

      // 2. Buscar resultados parciais das tasks completadas
      const { data: tasks, error: tasksError } = await (supabase
        .from('attack_surface_tasks')
        .select('ip, source, label, result')
        .eq('snapshot_id', snap.id)
        .eq('status', 'completed')
        .not('result', 'is', null) as any);

      if (!tasksError && tasks && tasks.length > 0) {
        const partialResults: Record<string, any> = {};
        for (const task of tasks as any[]) {
          if (task.ip && task.result) {
            partialResults[task.ip] = task.result;
          }
        }
        // Montar source_ips a partir das tasks se o snapshot nao tiver
        if (!snap.source_ips || snap.source_ips.length === 0) {
          snap.source_ips = (tasks as any[]).map((t: any) => ({
            ip: t.ip,
            source: t.source || 'dns',
            label: t.label || t.ip,
          }));
        }
        snap.results = partialResults;
      }

      return snap;
    },
    enabled: !!clientId && enabled,
    refetchInterval: 15000,
    staleTime: 10000,
  });
}
```

### Como funciona

1. Busca o snapshot com status `pending` ou `running` (como antes)
2. Usa o `snapshot.id` para buscar na tabela `attack_surface_tasks` todas as tasks com `status = 'completed'` e `result IS NOT NULL`
3. Monta o mapa `results` (chave = IP, valor = resultado do nmap/httpx) a partir dos dados das tasks
4. Tambem reconstroi `source_ips` a partir das tasks caso o snapshot nao tenha esse dado preenchido
5. Retorna o snapshot enriquecido com os dados parciais

Assim, a cada 15 segundos o hook refaz a query, pega mais IPs concluidos e a interface exibe os novos assets progressivamente.

### Arquivos

| Arquivo | Acao |
|---|---|
| `src/hooks/useAttackSurfaceData.ts` | Modificar `useRunningAttackSurfaceSnapshot` para buscar resultados parciais de `attack_surface_tasks` |

