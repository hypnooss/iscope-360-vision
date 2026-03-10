

## Plano: Atualizar empty state do Teams Analyzer

### Mudanças em `src/pages/m365/TeamsAnalyzerPage.tsx`

1. **Atualizar texto do card de aviso** (linhas 189-192): Trocar título para "Nenhuma análise do Teams encontrada" e descrição para indicar que não existem análises efetuadas até o momento.

2. **Unificar botão com `handleTriggerAnalysis`** (linhas 194-198): Trocar `onClick={refreshDashboard}` por `onClick={handleTriggerAnalysis}`, usar `triggering || loading` para disabled/loading e texto "Executar Análise".

3. **Remover Alert redundante do rodapé** (linhas 252-257): Remover o bloco que exibe "Nenhuma análise encontrada".

Mesmo padrão já aplicado no Entra ID Analyzer.

