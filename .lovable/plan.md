

## Unificar layout dos cards de Insights de Segurança do Firewall com o padrão M365

### Problema

Os cards de Insights de Segurança do Firewall Analyzer usam um layout próprio (métricas em grid, sheet lateral simples com emojis) que diverge do layout padronizado usado nos Analyzers M365 (badges inline de severidade/categoria/ocorrências, `IncidentDetailSheet` com abas Análise/Evidências).

### Solução

Refatorar `src/components/firewall/SecurityInsightCards.tsx` para usar o mesmo layout de cards e detail sheet do M365 shared (`SecurityInsightCard.tsx` + `IncidentDetailSheet`).

Como os tipos são diferentes (`FirewallSecurityInsight` vs `M365AnalyzerInsight`), a abordagem será **mapear** os dados do firewall para o formato `M365AnalyzerInsight` antes de renderizar, reutilizando os componentes existentes.

### Alterações

| Arquivo | Alteração |
|---|---|
| `src/components/firewall/SecurityInsightCards.tsx` | Substituir o layout customizado: mapear `FirewallSecurityInsight[]` para `M365AnalyzerInsight[]` e renderizar usando o componente `SecurityInsightCards` do M365 shared + `IncidentDetailSheet`. Remover o `InsightDetailSheet` interno. |
| `src/types/m365AnalyzerInsights.ts` | Adicionar uma categoria genérica `firewall_security` ao tipo `M365AnalyzerCategory` e ao mapa de labels, para suportar insights de firewall sem conflito. |

### Detalhes técnicos

**Mapeamento `FirewallSecurityInsight` → `M365AnalyzerInsight`:**

```typescript
function mapFirewallToAnalyzerInsight(fw: FirewallSecurityInsight): M365AnalyzerInsight {
  return {
    id: fw.id,
    category: 'firewall_security',
    name: fw.title,
    description: fw.what,
    severity: fw.severity,
    analysis: fw.why,
    recommendation: fw.bestPractice.join('\n'),
    businessImpact: fw.businessImpact,
    status: 'fail',
    count: fw.metrics.find(m => typeof m.value === 'number')?.value as number,
    metadata: {
      ...Object.fromEntries(fw.metrics.map(m => [m.label, m.value])),
      source: fw.source,
      complianceCode: fw.complianceCode,
    },
  };
}
```

O componente principal passa a importar e usar `SecurityInsightCards` do shared, mantendo apenas o header com contadores de correlações e o mapeamento de dados. A sheet lateral será automaticamente o `IncidentDetailSheet` unificado.

