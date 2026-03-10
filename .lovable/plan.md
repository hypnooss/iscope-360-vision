
# Aumentar espaçamentos entre seções do Exchange Analyzer

As linhas vermelhas no screenshot indicam 4 pontos onde falta respiro visual:

1. **Após "Última coleta"** → antes dos Stats Cards
2. **Após Stats Cards** → antes de "PANORAMA POR CATEGORIA"
3. **Após Category Grid** → antes de "STATUS DAS POLÍTICAS DE PROTEÇÃO"
4. **Após Threat Protection** → antes de Security Insights

## Alteração em `ExchangeAnalyzerPage.tsx`

Trocar os espaçamentos atuais (`mb-2` ou nenhum) por `mb-8` consistente entre todas as seções principais:

- Linha 202: adicionar `mb-8` ao wrapper do "Última coleta"
- Linha 231: trocar `mb-2` por `mb-8` no wrapper dos Stats Cards
- Linha 238: envolver `ExchangeAnalyzerCategoryGrid` em `<div className="mb-8">`
- Linha 243: envolver `ExchangeThreatProtectionSection` em `<div className="mb-8">`

Isso adiciona ~32px de respiro entre cada seção, reduzindo a densidade visual.
