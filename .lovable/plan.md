## M365 Analyzer - Plano de Implementação

### ✅ Fase 1: Infraestrutura e Coleta (Backend) — CONCLUÍDA

- [x] Tabelas criadas: `m365_analyzer_snapshots`, `m365_analyzer_schedules`, `m365_user_baselines`
- [x] Enum `m365_analyzer` adicionado ao `agent_task_type`
- [x] RLS policies configuradas para todas as tabelas
- [x] Edge Function: `trigger-m365-analyzer` — gatilho de snapshots
- [x] Edge Function: `m365-analyzer` — engine de processamento com 7 módulos
- [x] `run-scheduled-analyses` atualizado com suporte a `m365_analyzer_schedules`
- [x] `config.toml` atualizado

### 🔲 Fase 2: Frontend - Dashboard e Visualização

- [ ] Tipos TypeScript: `src/types/m365AnalyzerInsights.ts`
- [ ] Hook: `src/hooks/useM365AnalyzerData.ts`
- [ ] Página: `src/pages/m365/M365AnalyzerDashboardPage.tsx`
- [ ] Navegação: rota em `App.tsx` + menu em `AppLayout.tsx`

### 🔲 Fase 3: Baseline Comportamental e Correlação

- [ ] Engine de baseline com média móvel ponderada
- [ ] Correlação entre eventos (login + envio + regras)
- [ ] Comparação entre snapshots na UI

### 🔲 Fase 4: Refinamentos e Subpáginas

- [ ] Subpágina `/scope-m365/analyzer/insights`
- [ ] Subpágina `/scope-m365/analyzer/critical`
- [ ] Integração com relatórios PDF
