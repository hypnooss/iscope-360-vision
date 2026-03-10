

## Plano: Atualizar empty state do Entra ID Analyzer

### Mudanças em `src/pages/m365/EntraIdAnalyzerPage.tsx`

1. **Atualizar texto do card de aviso** (linhas 208-217): Trocar "Dados do Entra ID não sincronizados" por "Nenhuma análise do Entra ID encontrada" e ajustar a descrição para indicar que não existem análises efetuadas.

2. **Unificar botão com `handleTriggerAnalysis`** (linha 213): Trocar `onClick={refreshDashboard}` por `onClick={handleTriggerAnalysis}` e ajustar disabled/loading para usar `triggering || loading` em vez de `dashboardRefreshing`. Texto do botão: "Executar Análise".

3. **Remover o Alert redundante do rodapé** (linhas 281-286): Remover o bloco `{selectedTenantId && !loading && entraInsights.length === 0 && !analyzerSnapshot && (...)}` que exibe "Nenhuma análise encontrada".

### Resultado

Card de aviso com texto atualizado e botão com comportamento idêntico ao do topo. Alert inferior removido.

