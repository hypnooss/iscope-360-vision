
# Atualizar dados em tempo real durante scan no Attack Surface Analyzer

## Problema

Atualmente, o hook `useLatestAttackSurfaceSnapshot` so busca snapshots com `status === 'completed'`. Enquanto o scan esta em andamento, os dados parciais que ja foram processados (resultados de IPs concluidos) ficam armazenados no snapshot com status `running`, mas nao sao exibidos. O usuario so ve os novos dados quando o scan inteiro termina.

## Solucao

1. Criar uma nova query que busca o snapshot `running` com seus dados parciais
2. Quando o scan esta em andamento, usar os dados do snapshot running para exibir resultados parciais em tempo real
3. Adicionar um botao/indicador "Atualizando..." com auto-refresh no header da pagina
4. Manter os dados do ultimo snapshot completo como fallback

## Detalhes tecnicos

### 1. Novo hook no `useAttackSurfaceData.ts`

Adicionar `useRunningAttackSurfaceSnapshot` que busca o snapshot com status `pending` ou `running`, com `refetchInterval: 15000` (15s) para atualizar os dados parciais periodicamente.

```typescript
export function useRunningAttackSurfaceSnapshot(clientId?: string, enabled = true) {
  return useQuery({
    queryKey: ['attack-surface-running', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('attack_surface_snapshots')
        .select('*')
        .eq('client_id', clientId)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) return null;
      return parseSnapshot(rows[0]);
    },
    enabled: !!clientId && enabled,
    refetchInterval: 15000, // atualiza a cada 15 segundos
    staleTime: 10000,
  });
}
```

### 2. Modificar `AttackSurfaceAnalyzerPage.tsx`

**a) Importar e usar o novo hook:**

Ao lado do `useLatestAttackSurfaceSnapshot`, usar tambem o `useRunningAttackSurfaceSnapshot` (habilitado apenas quando `isRunning`).

**b) Determinar snapshot ativo:**

```typescript
const activeSnapshot = isRunning && runningSnapshot ? runningSnapshot : snapshot;
```

Quando o scan esta rodando e temos dados parciais, exibir o snapshot running. Caso contrario, usar o ultimo completo.

**c) Adicionar botao "Atualizando" no header:**

Quando `isRunning`, exibir um botao animado (com `Loader2` girando) ao lado do botao "Cancelar Scan", indicando que os dados estao sendo atualizados automaticamente. Clicar nele forca um refetch imediato.

```tsx
{isRunning && (
  <Button
    size="sm"
    variant="outline"
    className="border-teal-500/30 text-teal-400"
    onClick={() => refetchRunning()}
    disabled={isRefetchingRunning}
  >
    <Loader2 className="w-4 h-4 animate-spin" />
    Atualizando...
  </Button>
)}
```

**d) Usar `activeSnapshot` no lugar de `snapshot`:**

Na construcao dos assets e nas stats, trocar `snapshot` por `activeSnapshot` para que os dados parciais sejam renderizados.

### Arquivos a modificar

| Arquivo | Acao |
|---|---|
| `src/hooks/useAttackSurfaceData.ts` | Adicionar export `useRunningAttackSurfaceSnapshot` |
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Importar novo hook, calcular `activeSnapshot`, adicionar botao "Atualizando", usar `activeSnapshot` nos assets e stats |
