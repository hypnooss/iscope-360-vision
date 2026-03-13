

## Diagnóstico: Entra ID Analyzer sem dados operacionais

### Causa raiz identificada

Investiguei as network requests e confirmei:

1. **`m365_dashboard_snapshots` (entra_id)** retorna `[]` (vazio)
2. **`m365_tenants.entra_dashboard_cache`** retorna `null`
3. O **Exchange dashboard** funciona porque TEM dados na mesma tabela (`dashboard_type=exchange`)

A Edge Function `entra-id-dashboard` tem dois problemas:

**Problema 1 (Backend):** A função não está persistindo dados. O insert em `m365_dashboard_snapshots` e o update em `m365_tenants` estão falhando silenciosamente. Isso precisa ser investigado nos logs da Edge Function (pode ser um problema de deploy ou permissão).

**Problema 2 (Frontend):** A função `refresh()` no hook `useEntraIdDashboard` (linha 93) verifica `if (!result?.success)` mas a Edge Function retorna o resultado SEM o campo `success: true`. Isso significa que mesmo quando a função roda com sucesso via "Executar Análise", o frontend rejeita a resposta válida e não atualiza o estado.

### Plano de correção

#### 1. Corrigir a Edge Function (`entra-id-dashboard/index.ts`)
- Adicionar `success: true` ao objeto `result` antes de retornar na resposta (linha 351)
- Isso alinha com o padrão documentado nas memórias do projeto

#### 2. Corrigir o hook `useEntraIdDashboard` (frontend)
- Ajustar a verificação `!result?.success` para aceitar respostas que contenham os dados esperados (ex: `result?.users`) como fallback
- Isso garante que o refresh funcione mesmo com versões antigas da Edge Function

#### 3. Adicionar fallback: extrair KPIs do analyzer snapshot
- Quando `dashboardData` é null mas o `analyzerSnapshot` existe com `metrics`, derivar os KPIs operacionais do campo `metrics` do snapshot (que contém `identity.noMfaUsers`, `securityRisk.riskyUsers`, etc.)
- Isso garante que a tela nunca fique vazia quando há dados de análise disponíveis
- Modificar `EntraIdAnalyzerPage.tsx` para construir um `dashboardData` de fallback a partir de `analyzerSnapshot.metrics`

#### 4. Re-deploy da Edge Function
- Após a correção, será necessário fazer o deploy da Edge Function para que o `success: true` e a persistência funcionem corretamente

### Arquivos alterados
- `supabase/functions/entra-id-dashboard/index.ts` — adicionar `success: true` na resposta
- `src/hooks/useEntraIdDashboard.ts` — corrigir validação do refresh
- `src/pages/m365/EntraIdAnalyzerPage.tsx` — fallback de KPIs via analyzer snapshot metrics

