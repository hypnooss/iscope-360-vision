

## Corrigir exibição de cards com status OK

### Causa raiz

Os cards OK não aparecem por **duas razões distintas**:

**1. Exchange e Entra ID** — A função `isConfigurationalInsight()` (presente em `ExchangeAnalyzerPage.tsx` e `EntraIdAnalyzerPage.tsx`) filtra insights que não têm `count` nem `affectedUsers`. Insights de status `pass` tipicamente não possuem esses campos, então são removidos.

```typescript
// Linha 57 — filtra insights sem count/affectedUsers (remove todos os pass!)
if ((insight.count === undefined || insight.count === 0) && 
    (!insight.affectedUsers || insight.affectedUsers.length === 0)) return true;
```

**2. Colaboração (Teams)** — A edge function `collaboration-dashboard` não gera nenhum insight. As categorias de colaboração (`teams_governance`, `sharepoint_exposure`, etc.) não existem no `m365-analyzer` nem em nenhuma outra edge function.

### Solução

| Arquivo | Alteração |
|---|---|
| `src/pages/m365/ExchangeAnalyzerPage.tsx` | Modificar `isConfigurationalInsight` para ignorar insights com `status: 'pass'` (retornar `false` imediatamente) |
| `src/pages/m365/EntraIdAnalyzerPage.tsx` | Mesma correção no `isConfigurationalInsight` |
| `supabase/functions/m365-analyzer/index.ts` | Adicionar insights de `status: 'pass'` para categorias que faltam (ex: `behavioral_baseline`, `suspicious_rules`, `exfiltration` quando sem ocorrências) |
| `supabase/functions/collaboration-dashboard/index.ts` | Adicionar geração de insights com `status: 'pass'` e `'fail'` para as categorias de colaboração (`teams_governance`, `guest_access`, `external_sharing`, `sharepoint_exposure`, `collaboration_risk`) baseados nos dados já coletados pela função |

### Correção no filtro (Exchange + Entra ID)

```typescript
function isConfigurationalInsight(insight: M365AnalyzerInsight): boolean {
  // Never filter out pass/OK insights
  if (insight.status === 'pass') return false;
  
  const name = insight.name.toLowerCase();
  if (CONFIG_KEYWORDS.some(kw => name.includes(kw))) return true;
  if ((insight.count === undefined || insight.count === 0) && 
      (!insight.affectedUsers || insight.affectedUsers.length === 0)) return true;
  return false;
}
```

### Insights de colaboração (collaboration-dashboard)

Adicionarei geração de insights baseados nos dados que a função já coleta (teams, sharepoint sites, guests, sharing policies), gerando cards `pass` quando verificações estão OK e `fail` quando há problemas, com categorias mapeadas para `teams_governance`, `guest_access`, `external_sharing`, `sharepoint_exposure`.

