

## Problema

A página M365 Compliance (`M365PosturePage.tsx`) não exibe a barra de progresso durante a análise. O `triggerAnalysis` no hook `useM365SecurityPosture` faz polling internamente (while loop de 60 tentativas), mas o único feedback visual é o spinner no botão "Analisando...". Nas páginas de Firewall e External Domain Compliance, existe uma barra de progresso visível com tempo decorrido e status do agent.

## Solução

Adicionar o mesmo padrão de barra de progresso que existe no Firewall Compliance:

### Alterações

**1. `src/hooks/useM365SecurityPosture.ts`**

Expor o estado do polling para o componente:
- Adicionar `analysisId` e `analysisStatus` ao estado do hook
- Ao invés do while-loop interno, retornar o `analysisId` e deixar o componente fazer polling via `useQuery` (igual ao Firewall)
- Manter `isLoading` como true enquanto a análise roda

**2. `src/pages/m365/M365PosturePage.tsx`**

- Adicionar estado `activeAnalysisId` e `analysisStartedAt`
- Adicionar `useQuery` com polling de 5s na tabela `m365_posture_history` (status) quando `activeAnalysisId` existe
- Renderizar barra de progresso idêntica à do Firewall entre o header e o "Última coleta"
- Ao detectar `completed` ou `failed`, limpar o `activeAnalysisId` e chamar `refetch()`

### Componente da barra de progresso (mesmo padrão do Firewall)

```tsx
{isAnalysisRunning && (
  <div className="rounded-lg border bg-card p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <div>
        <p className="text-sm font-medium">Análise em andamento...</p>
        <p className="text-xs text-muted-foreground">
          {analysisStatus === 'partial' ? 'Graph API concluída, aguardando Agent' : 'Processando...'}
          {analysisStartedAt && ` · ${elapsed}s`}
        </p>
      </div>
    </div>
    <Progress value={analysisStatus === 'partial' ? 60 : 30} className="h-2" />
  </div>
)}
```

### Fluxo

1. Usuário clica "Executar Análise"
2. `triggerAnalysis()` retorna `analysisId` → salva no estado
3. Polling de 5s mostra barra de progresso com status (`pending` → `partial` → `completed`)
4. Ao completar, limpa estado e exibe resultado

