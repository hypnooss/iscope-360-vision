

## Plano: Corrigir botão "Executar Análise" do card de aviso

### Problema

O botão "Executar Análise" dentro do card de aviso (empty state) chama `refreshDashboard` — que apenas invoca a Edge Function `exchange-dashboard`. Já o botão do topo chama `handleTriggerAnalysis`, que dispara **ambos** os fluxos (`trigger-m365-analyzer` + `exchange-dashboard`) via `Promise.all`.

### Mudança

**Arquivo:** `src/pages/m365/ExchangeAnalyzerPage.tsx` (linha 255)

Trocar `onClick={refreshDashboard}` por `onClick={handleTriggerAnalysis}` e ajustar o `disabled` e o estado de loading para usar as mesmas flags do botão do topo:

```tsx
<Button 
  onClick={handleTriggerAnalysis} 
  disabled={triggering || isAnalysisRunning || !selectedTenantId || loading} 
  className="gap-2"
>
  {triggering || isAnalysisRunning
    ? <><Loader2 className="w-4 h-4 animate-spin" />Analisando...</>
    : <><Play className="w-4 h-4" />Executar Análise</>}
</Button>
```

Isso garante comportamento idêntico ao botão do cabeçalho.

