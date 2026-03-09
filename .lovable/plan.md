# Status: ✅ Implementado

## Otimização Round 2: Redução adicional de carga no Supabase Nano

### Mudanças aplicadas

| Arquivo | Mudança |
|---|---|
| App.tsx | QueryClient: `refetchOnWindowFocus: false`, `retry: 1`, `staleTime: 30s` |
| AuthContext.tsx | Removido `getSession()` redundante no `checkMfaStatus` |
| useDashboardStats.ts | Queries serializadas em batches de 2-3 (era 4+6 paralelas) |
| Migration SQL | Índices em `agents`, `system_alerts`, `user_roles`, `user_module_permissions` — **PENDENTE** (Supabase timeout) |

### Otimizações Round 1 (anterior)

| Arquivo | Antes | Depois |
|---|---|---|
| AgentDetailPage.tsx | 5s | 15s |
| FirewallCompliancePage.tsx | 5s | 15s |
| M365PosturePage.tsx | 5s | 15s |
| ExternalDomainCompliancePage.tsx | 5s | 15s |
| useAnalyzerData.ts | 10s | 30s |
| useM365AnalyzerData.ts | 10s | 30s |
| useAttackSurfaceData.ts | 15s | 30s |
| SuperAgentsPage.tsx | 15s | 30s |
| SurfaceAnalyzerV3Page.tsx | 10s | 30s |
| SchedulesPage.tsx (×6 queries) | 30s | 60s |
| SchedulesPage.tsx (executions) | 15s | 30s |
