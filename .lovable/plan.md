

## Problema

Quando o usuário clica "Executar Análise":
1. `triggering` fica `true` por ~5-10s (duração das chamadas HTTP)
2. Ao terminar, `triggering` volta a `false` e a barra desaparece
3. O hook `useM365AnalyzerProgress` faz polling a cada **30s** — então leva até 30s para detectar o novo snapshot `pending`
4. Resultado: gap onde nenhum indicador é visível, mesmo com tarefa rodando

## Correção em `src/pages/m365/ExchangeAnalyzerPage.tsx`

### 1. Refetch imediato após trigger
No `handleTriggerAnalysis`, após o `Promise.all`, invalidar a query de progresso para que detecte o novo snapshot imediatamente:
```ts
queryClient.invalidateQueries({ queryKey: ['m365-analyzer-progress', selectedTenantId] });
```

### 2. Manter `triggering` até polling assumir
Não resetar `triggering` no `finally`. Em vez disso, resetar via `useEffect` quando `isAnalysisRunning` se tornar `true` (polling detectou a tarefa):
```ts
useEffect(() => {
  if (isAnalysisRunning && triggering) setTriggering(false);
}, [isAnalysisRunning]);
```
Isso garante que a barra permanece visível durante a transição.

### 3. Polling mais frequente durante execução
No hook `useM365AnalyzerProgress` em `src/hooks/useM365AnalyzerData.ts`, usar `refetchInterval` dinâmico: 5s quando ativo, 30s em idle. Para isso, passar o resultado para um `refetchInterval` funcional:
```ts
refetchInterval: (query) => {
  const status = query.state.data?.status;
  if (status === 'pending' || status === 'processing') return 5000;
  return 30000;
},
```

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `ExchangeAnalyzerPage.tsx` | Invalidar query de progresso após trigger; manter `triggering` até polling assumir |
| `useM365AnalyzerData.ts` | Polling dinâmico: 5s durante execução, 30s em idle |

