

# Diagnóstico: Supabase Nano saturado — Plano de Otimização

## Situação Atual

Seu projeto roda num **Supabase Nano** (0.5 GB RAM, shared CPU). Os screenshots mostram CPU batendo 75%+ e memória consistentemente alta. Todos os erros 504 são consequência direta dessa saturação.

**A alteração de MFA/Trusted Device NÃO causou isso** — ela é puramente `localStorage` no frontend. O problema é carga acumulada no banco.

## Fontes de carga identificadas no código

### 1. Frontend: polling agressivo (MAIOR impacto)

| Página/Hook | Intervalo | Queries/min |
|---|---|---|
| AgentDetailPage | **5s** | 12/min |
| FirewallCompliancePage | **5s** | 12/min |
| M365PosturePage | **5s** | 12/min |
| ExternalDomainCompliancePage | **5s** | 12/min |
| useAnalyzerData | **10s** | 6/min |
| useM365AnalyzerData | **10s** | 6/min |
| useAttackSurfaceData | **15s** | 4/min |
| SuperAgentsPage | **15s** | 4/min |
| SchedulesPage (×6 queries) | **30s** | 12/min |

Com uma aba aberta, são **~80+ queries/min** só do frontend. Com 2-3 abas, triplica.

### 2. Agents: polling a cada 60s

Cada agent faz `GET /agent-tasks` a cada 60s + token refresh periódico. Com N agents, são N requests/min constantes.

### 3. Edge Functions pesadas

`firewall-analyzer`, `run-scheduled-analyses` fazem queries complexas que competem por conexões no pool limitado do Nano.

## Plano de Otimização (sem upgrade de plano)

### Mudança 1: Aumentar intervalos de polling no frontend

Dobrar ou triplicar todos os `refetchInterval`, usando polling condicional onde já não existe:

- **5s → 15s** (páginas de compliance/detail com tasks ativas)
- **10s → 30s** (hooks de analyzer data)
- **15s → 30s** (attack surface, super agents)
- **30s → 60s** (schedules page)

Manter o padrão inteligente que já existe em algumas páginas: polling rápido só quando há tasks ativas, senão `false`.

### Mudança 2: Polling condicional no AgentDetailPage

Atualmente faz polling incondicional a cada 5s. Mudar para polling apenas quando há tasks `running`/`pending`.

### Mudança 3: SchedulesPage — consolidar 6 queries em 1

A página de Schedules faz **6 queries separadas** (fw, dom, as, an, m365, tasks), cada uma com `refetchInterval: 30s`. Consolidar num único `queryFn` que busca tudo de uma vez, com intervalo de 60s.

### Arquivos alterados

- `src/pages/AgentDetailPage.tsx` — polling condicional
- `src/pages/firewall/FirewallCompliancePage.tsx` — 5s → 15s
- `src/pages/m365/M365PosturePage.tsx` — 5s → 15s
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx` — 5s → 15s
- `src/hooks/useAnalyzerData.ts` — 10s → 30s
- `src/hooks/useM365AnalyzerData.ts` — 10s → 30s
- `src/hooks/useAttackSurfaceData.ts` — 15s → 30s
- `src/pages/admin/SuperAgentsPage.tsx` — 15s → 30s
- `src/pages/admin/SchedulesPage.tsx` — 30s → 60s
- `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` — 10s → 30s

Estimativa: redução de **~60-70%** das queries/min ao banco, o que deve eliminar os 504s no plano Nano.

