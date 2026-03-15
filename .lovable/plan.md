

## Exibir insights ocultos com status "N/A"

### Problema

Os insights que são filtrados por `isConfigurationalInsight` (zero ocorrências, sem usuários afetados, ou com palavras-chave configuracionais) são completamente removidos da UI. O usuário quer que eles apareçam como cards "N/A" (Não Aplicável), similar ao padrão já usado no sistema de conformidade.

### Solução

Parar de filtrar esses insights e, em vez disso, marcá-los com um status visual "N/A" no card.

| Arquivo | Alteração |
|---|---|
| `src/pages/m365/EntraIdAnalyzerPage.tsx` | Remover o filtro `isConfigurationalInsight` — passar todos os insights das categorias Entra |
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | Remover o filtro `isConfigurationalInsight` — passar todos os insights das categorias Exchange |
| `src/components/m365/shared/SecurityInsightCard.tsx` | Adicionar tratamento visual para insights "N/A": detectar insights com `count === 0`, sem `affectedUsers` e `status !== 'pass'` que contenham keywords configuracionais. Renderizar com borda cinza (`border-l-slate-400`), badge "N/A" em cinza, e `opacity-70`. Ordená-los após os pass insights. Adicionar contador de N/A no header |
| `src/types/m365AnalyzerInsights.ts` | Adicionar `'not_applicable'` ao tipo `status` da interface `M365AnalyzerInsight` |

### Detalhes técnicos

Na `SecurityInsightCard.tsx`, criar uma função `isNAInsight` que replica a lógica de `isConfigurationalInsight` para identificar os insights que devem receber tratamento N/A:

```typescript
function isNAInsight(insight: M365AnalyzerInsight): boolean {
  if (insight.status === 'pass') return false;
  const name = insight.name.toLowerCase();
  const configKeywords = ['desabilitado', 'disabled', 'configuração', 'configuracao', 'policy', 'habilitado', 'enabled'];
  if (configKeywords.some(kw => name.includes(kw))) return true;
  if ((insight.count === undefined || insight.count === 0) && (!insight.affectedUsers || insight.affectedUsers.length === 0)) return true;
  return false;
}
```

Ordenação final: `fail` (por severidade) → `pass` → `N/A`.

Visual do card N/A: borda cinza, ícone `MinusCircle`, badge "N/A" com estilo `bg-slate-500/15 text-slate-400`, sem descrição, opacidade reduzida.

