# Status: ✅ Implementado

## Otimização: Redução de polling para aliviar Supabase Nano

### Mudanças aplicadas

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

Estimativa: redução de ~60-70% das queries/min ao banco.
