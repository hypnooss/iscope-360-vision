

## Otimizacao de Payloads Supabase - Reducao de `affectedEntities` ✅

### Status: IMPLEMENTADO

### O que foi feito

1. **Database Functions criadas:**
   - `get_posture_insights_lite(p_tenant_record_id uuid)` — retorna insights com `affectedEntities` removido, substituído por `affectedCount` + `_entitiesPreview` (primeiros 3 nomes)
   - `get_insight_affected_entities(p_history_id uuid, p_insight_code text)` — retorna `affectedEntities` completo para drill-down sob demanda

2. **Hooks otimizados:**
   - `useM365SecurityPosture.ts` — usa RPC `get_posture_insights_lite` em vez de `select('*')`
   - `useM365AnalyzerData.ts` — `select('*')` → colunas explícitas sem `insights`
   - `useEntraIdInsights.ts` — usa RPC lite
   - `useEntraIdSecurityInsights.ts` — usa RPC lite
   - `useEntraIdApplicationInsights.ts` — usa RPC lite

3. **Carregamento sob demanda:**
   - `useAffectedEntities.ts` — novo hook para carregar entidades via RPC
   - `M365AffectedEntitiesDialog` — carrega entidades sob demanda ao abrir
   - `complianceMappers.ts` — suporta `_entitiesPreview` para exibir prévia sem payload completo

### Impacto
Reducao de payload estimada em 70-90% nas queries de postura M365.
