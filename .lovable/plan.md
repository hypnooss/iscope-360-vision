

## Adicionar "Análise Efetuada" e "Impacto no Negócio" ao IncidentDetailSheet

### Problema

O `IncidentDetailSheet` exibe apenas DESCRIÇÃO, IMPACTO (genérico) e RECOMENDAÇÃO. Faltam as seções "ANÁLISE EFETUADA" e "IMPACTO NO NEGÓCIO" presentes nos módulos de Compliance e Surface Analyzer.

### Solução

**1. Tipo `M365AnalyzerInsight`** — Adicionar campos opcionais:
- `analysis?: string` — texto da análise efetuada
- `businessImpact?: string` — impacto no negócio

**2. `IncidentDetailSheet.tsx`** — Adicionar seções entre DESCRIÇÃO e RECOMENDAÇÃO:
- **ANÁLISE EFETUADA** (ícone `Search`, variant default) — renderiza `insight.analysis`; se ausente, gera fallback automático baseado em `count`, `affectedUsers`, `severity` e `metadata` (ex: "Foram identificadas 9 ocorrências classificadas como High. A análise correlacionou dados de telemetria do Exchange Online...")
- **IMPACTO NO NEGÓCIO** (ícone `Building2`, variant destructive/warning) — renderiza `insight.businessImpact`; se ausente, gera fallback baseado na severidade e categoria (ex: "Incidentes ativos podem causar interrupção nos serviços de email...")
- Renomear a seção "IMPACTO" atual para "IMPACTO NO NEGÓCIO" com ícone `Building2`
- Adicionar variant `destructive` ao Section component (bg vermelho suave)

**3. Edge functions** (Exchange, Entra ID, Colaboração) — Adicionar `analysis` e `businessImpact` nos `insights.push()` mais relevantes (insights de severidade high/critical). Insights de menor severidade usarão o fallback do frontend.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/types/m365AnalyzerInsights.ts` | +2 campos opcionais |
| `src/components/m365/analyzer/IncidentDetailSheet.tsx` | +2 seções, +1 variant, fallbacks |
| `supabase/functions/m365-analyzer/index.ts` | Adicionar `analysis`/`businessImpact` nos insights principais |
| `supabase/functions/entra-id-dashboard/index.ts` | Idem |
| `supabase/functions/collaboration-dashboard/index.ts` | Idem |

