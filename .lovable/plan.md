

## Corrigir barra de progresso: detectar análise em andamento ao carregar a página

### Problema
O `activeAnalysisId` é estado React local — se a página recarrega ou o preview atualiza, o estado se perde e a barra de progresso desaparece. A página precisa verificar se há uma análise pendente/parcial ao montar.

### Solução

**`src/pages/m365/M365PosturePage.tsx`:**

Adicionar um `useQuery` que roda ao montar a página para detectar análises ativas:

```typescript
// Detect in-progress analysis on mount
const { data: activeAnalysis } = useQuery({
  queryKey: ['m365-active-analysis', selectedTenantId],
  queryFn: async () => {
    if (!selectedTenantId) return null;
    const { data } = await supabase
      .from('m365_posture_history')
      .select('id, status, created_at')
      .eq('tenant_record_id', selectedTenantId)
      .in('status', ['pending', 'partial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  },
  enabled: !!selectedTenantId && !activeAnalysisId,
});
```

Adicionar um `useEffect` para restaurar o estado:

```typescript
useEffect(() => {
  if (activeAnalysis && !activeAnalysisId) {
    setActiveAnalysisId(activeAnalysis.id);
    setAnalysisStartedAt(new Date(activeAnalysis.created_at).getTime());
  }
}, [activeAnalysis, activeAnalysisId]);
```

Isso garante que ao abrir/recarregar a página, se existir uma análise pendente ou parcial, a barra de progresso aparece automaticamente.

