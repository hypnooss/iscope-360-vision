

## Diagnóstico e Plano: Colaboração Analyzer vazio + segurança Exchange

### Exchange Analyzer: sem risco de quebra

As alterações anteriores foram exclusivamente em:
- `useEntraIdDashboard.ts` — hook usado apenas pelo Entra ID Analyzer
- `EntraIdAnalyzerPage.tsx` — página exclusiva do Entra ID
- `entra-id-dashboard/index.ts` — Edge Function exclusiva do Entra ID

Nenhum desses arquivos é importado ou referenciado pelo Exchange Analyzer. **Não há risco de quebra.**

### Colaboração Analyzer: mesmo problema

O screenshot confirma: a tela mostra a linha de coleta (6 coletas, período agregado) mas nenhum card de dados. A causa é idêntica ao Entra ID:

1. `m365_dashboard_snapshots` com `dashboard_type=collaboration` retorna `[]`
2. `collaboration_dashboard_cache` no `m365_tenants` é `null`
3. A Edge Function `collaboration-dashboard` já tem `success: true` (diferente do Entra ID), mas a persistência no DB está falhando silenciosamente

O `TeamsAnalyzerPage` (linhas 240-257) condiciona Stats Cards e Category Grid a `dashboardData` existir, então sem cache = tela vazia.

### Plano de correção

Aplicar o mesmo padrão de fallback já implementado no Entra ID Analyzer:

**`src/pages/m365/TeamsAnalyzerPage.tsx`**:
- Criar `effectiveDashboardData` que, quando `dashboardData` é null mas `analyzerSnapshot?.metrics` existe, derive os KPIs de colaboração a partir dos metrics do snapshot
- Os campos relevantes no metrics incluem: `teams` (total, public, private), `sharepoint` (sites, storage), extraídos dos dados do analyzer
- Substituir referências a `dashboardData` por `effectiveDashboardData` nos blocos de Stats Cards e Category Grid
- Ajustar o empty state para só aparecer quando AMBOS dashboardData e analyzerSnapshot são null

**`src/hooks/useCollaborationDashboard.ts`**:
- Adicionar fallback na validação do `refresh()` (linha 81): aceitar `result?.teams` como evidência de sucesso, mesmo sem `success: true`
- Isso previne problemas futuros caso a Edge Function perca o campo

### Arquivos alterados
- `src/pages/m365/TeamsAnalyzerPage.tsx` — fallback de KPIs via analyzer metrics
- `src/hooks/useCollaborationDashboard.ts` — validação resiliente no refresh

