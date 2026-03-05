

## Plano de Implementacao — M365 Analyzer: 6 Melhorias

---

### 1. Historico de Snapshots com Tendencia Visual

**O que**: Adicionar um sparkline no card "Risco Atual" mostrando a evolucao do score ao longo dos ultimos 24 snapshots.

**Como**:
- O hook `useLatestM365AnalyzerSnapshot` ja carrega ate 24 snapshots com `score` e `created_at`. O `aggregateSnapshots` hoje descarta o historico individual.
- Retornar um array `scoreHistory: { date: string; score: number }[]` no resultado agregado.
- Criar componente `AnalyzerScoreSparkline` (reutilizando padrao de `ScoreSparkline` do dashboard) e renderiza-lo dentro do card de "Risco Atual" (linha ~638-685 da page).

**Arquivos**:
- `src/hooks/useM365AnalyzerData.ts` — expor `scoreHistory` no retorno de `aggregateSnapshots`
- `src/components/m365/analyzer/AnalyzerScoreSparkline.tsx` — novo componente (recharts AreaChart)
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` — renderizar sparkline no card de risco

---

### 2. Comparacao Delta entre Snapshots (Diff Automatico)

**O que**: Banner no topo mostrando "Desde a ultima coleta: +3 novos · 2 resolvidos · 1 escalou".

**Como**:
- Carregar insights do penultimo snapshot (o hook ja tem os IDs dos 24 snapshots).
- Criar query separada para buscar `insights` do 2o snapshot mais recente.
- Comparar por `category::name`: novos (existem no atual, nao no anterior), resolvidos (vice-versa), escalados (mesmo insight com severidade maior).
- Renderizar um card compacto com badges coloridos acima das tabs.

**Arquivos**:
- `src/hooks/useM365AnalyzerData.ts` — nova query `useM365AnalyzerDiff` que busca insights do snapshot anterior e computa delta
- `src/components/m365/analyzer/SnapshotDiffBanner.tsx` — novo componente com badges (verde=resolvidos, vermelho=novos, amarelo=escalados)
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` — renderizar banner entre o card de risco e as tabs

---

### 3. Movimento Externo — Indicador de Maturidade do Baseline

**O que**: Na aba "Movimento Externo", mostrar quantos dias de baseline ja foram coletados e quando o motor comecara a gerar alertas (minimo 7 dias).

**Como**:
- Consultar `m365_user_external_daily_stats` para contar dias distintos por tenant (`SELECT COUNT(DISTINCT stat_date)`).
- Exibir um indicador visual tipo "Baseline: 3/7 dias coletados" com progress bar e mensagem contextual.

**Arquivos**:
- `src/hooks/useExternalMovementData.ts` — adicionar query `useBaselineMaturity` que conta dias distintos na tabela de stats
- `src/components/m365/analyzer/ExternalMovementTab.tsx` — renderizar card de maturidade no topo da aba quando < 7 dias
- `src/components/m365/analyzer/BaselineMaturityCard.tsx` — novo componente com progress bar e labels

---

### 4. Metricas do Resumo Executivo (KPI Cards)

**O que**: Linha de cards compactos no topo do dashboard (abaixo do "Risco Atual") com KPIs extraidos das metricas ja coletadas pelo backend.

**KPIs selecionados** (dados ja disponiveis em `snapshot.metrics`):
- Logins de Risco (`securityRisk.highRiskSignIns`)
- Falhas MFA (`securityRisk.mfaFailures`)
- Usuarios sem MFA (`identity.noMfaUsers`)
- Forwards Externos (`rules.externalForwards`)
- Logins Suspeitos (`compromise.suspiciousLogins`)
- Usuarios Anomalos (`behavioral.anomalousUsers`)

**Como**:
- Criar componente `AnalyzerKPIRow` com 6 `StatCard` compactos em grid responsivo.
- Mapear cada metrica a um icone, cor (baseada em threshold) e label.

**Arquivos**:
- `src/components/m365/analyzer/AnalyzerKPIRow.tsx` — novo componente grid de KPI cards
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` — renderizar entre o card de risco e as tabs

---

### 5. Notificacoes / Alertas Proativos

**O que**: Quando uma analise do M365 Analyzer conclui com incidentes criticos, criar automaticamente um `system_alert` para notificar operadores via o banner ja existente (`SystemAlertBanner`).

**Como**:
- Na Edge Function `m365-analyzer` (ou na logica de finalizacao do snapshot), ao detectar `summary.critical > 0`, inserir um registro em `system_alerts` com:
  - `alert_type: 'm365_analyzer_critical'`
  - `severity: 'error'` ou `'warning'`
  - `title/message` com contagem de incidentes
  - `metadata: { tenant_record_id, snapshot_id, critical_count }`
- Atualizar `SystemAlertBanner` para reconhecer `m365_analyzer_critical` e linkar ao dashboard do Analyzer.
- Atualizar `alertLifetime.ts` para definir lifetime adequado (ex: 4h).

**Arquivos**:
- `supabase/functions/m365-analyzer/index.ts` — adicionar insert em `system_alerts` ao finalizar com criticos
- `src/components/alerts/SystemAlertBanner.tsx` — adicionar handler para `m365_analyzer_critical` com botao "Ver Analyzer"
- `src/components/alerts/alertLifetime.ts` — adicionar entry para o novo tipo de alerta

---

### Resumo de Arquivos Impactados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useM365AnalyzerData.ts` | Expor scoreHistory, nova query de diff |
| `src/hooks/useExternalMovementData.ts` | Nova query baseline maturity |
| `src/pages/m365/M365AnalyzerDashboardPage.tsx` | Integrar sparkline, diff banner, KPI row |
| `src/components/m365/analyzer/AnalyzerScoreSparkline.tsx` | Novo |
| `src/components/m365/analyzer/SnapshotDiffBanner.tsx` | Novo |
| `src/components/m365/analyzer/BaselineMaturityCard.tsx` | Novo |
| `src/components/m365/analyzer/AnalyzerKPIRow.tsx` | Novo |
| `src/components/m365/analyzer/ExternalMovementTab.tsx` | Integrar baseline card |
| `supabase/functions/m365-analyzer/index.ts` | Alertas proativos |
| `src/components/alerts/SystemAlertBanner.tsx` | Handler novo tipo |
| `src/components/alerts/alertLifetime.ts` | Lifetime config |

### Ordem de Implementacao Sugerida

1. KPI Cards (4) — impacto visual imediato, dados ja disponiveis
2. Sparkline de Tendencia (1) — dados ja carregados, componente simples
3. Diff Banner (2) — requer 1 query extra
4. Baseline Maturity (3) — requer query na tabela de stats
5. Alertas Proativos (5) — requer alteracao em Edge Function

