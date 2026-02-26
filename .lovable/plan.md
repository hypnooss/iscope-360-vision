

## Fase 2: Frontend - Dashboard M365 Analyzer

### Arquivos a criar

#### 1. `src/types/m365AnalyzerInsights.ts`
Tipos TypeScript para o M365 Analyzer, espelhando `analyzerInsights.ts`:
- `M365AnalyzerCategory` -- union type: `'phishing_threats' | 'mailbox_capacity' | 'behavioral_baseline' | 'account_compromise' | 'suspicious_rules' | 'exfiltration' | 'operational_risks'`
- `M365AnalyzerSeverity` -- `'critical' | 'high' | 'medium' | 'low' | 'info'`
- `M365AnalyzerInsight` -- id, category, name, description, severity, details, affectedUsers, count, recommendation, metadata
- `M365AnalyzerSummary` -- critical, high, medium, low, info (contadores)
- `M365AnalyzerMetrics` -- objeto com sub-chaves por modulo (phishing, mailbox, behavioral, compromise, rules, exfiltration, operational), cada uma com suas metricas especificas
- `M365AnalyzerSnapshot` -- id, tenant_record_id, client_id, status, period_start, period_end, score, summary, insights, metrics, created_at, agent_task_id
- Constante `M365_ANALYZER_CATEGORY_LABELS` com labels em portugues para cada categoria
- Helper `groupM365AnalyzerInsightsByCategory()`

#### 2. `src/hooks/useM365AnalyzerData.ts`
Hook de dados seguindo o padrao de `useAnalyzerData.ts`:
- `useLatestM365AnalyzerSnapshot(tenantRecordId)` -- busca ate 24 snapshots completed, agrega em visao consolidada 24h
- `useM365AnalyzerProgress(tenantRecordId)` -- polling a cada 10s para status de snapshot pendente/processando
- Funcoes de agregacao: soma de severidades, merge de insights com deduplicacao

#### 3. `src/pages/m365/M365AnalyzerDashboardPage.tsx`
Pagina principal do Analyzer M365 (~600 linhas), seguindo o layout do `AnalyzerDashboardPage.tsx` do Firewall:

**Cabecalho:**
- Breadcrumb: Microsoft 365 > Analyzer
- Titulo "M365 Analyzer" com subtitulo
- `TenantSelector` (reutilizado de posture)
- Botao "Executar Analise" que invoca `trigger-m365-analyzer`
- Botao de agendamento (Settings icon) para super roles

**Progress Card:**
- Quando analise esta em andamento, exibe barra de progresso com status e tempo decorrido

**Info do Snapshot:**
- Data da ultima coleta, periodo agregado, quantidade de coletas

**Cards de Severidade:**
- 4 cards: Critical, High, Medium, Low (mesmo padrao visual do FW Analyzer)

**Resumo de Metricas:**
- Grid de cards com metricas dos 7 modulos:
  - Phishing total, Mailboxes criticas (>90%), Comportamentos anomalos, Logins suspeitos, Regras suspeitas, Envios para dominios externos, Riscos operacionais

**Top Riscos Agora:**
- Lista dos insights de severidade critical/high, usando `RankingListWidget` adaptado

**Tabs por Categoria:**
- Phishing e Ameacas
- Capacidade de Mailbox
- Baseline Comportamental
- Comprometimento de Conta
- Regras Suspeitas
- Exfiltracao
- Riscos Operacionais

Cada tab exibe os insights da categoria com cards no padrao existente (nome, descricao, severidade badge, usuarios afetados, recomendacao).

**Dialog de Agendamento:**
- Frequencia (hourly/daily/weekly/monthly)
- Hora, dia da semana, dia do mes
- Ativo/Inativo
- Upsert em `m365_analyzer_schedules`

### Arquivos a modificar

#### 4. `src/App.tsx`
Adicionar rota:
```
<Route path="/scope-m365/analyzer" element={<M365AnalyzerDashboardPage />} />
```

#### 5. `src/components/layout/AppLayout.tsx`
Adicionar item "Analyzer" no menu do `scope_m365` (linha ~135-145), entre "Exchange Online" e "Execucoes":
```
{ label: 'Analyzer', href: '/scope-m365/analyzer', icon: Activity }
```

#### 6. `.lovable/plan.md`
Marcar Fase 2 como concluida.

### Detalhes de implementacao

- Reutilizar `TenantSelector` e `useM365TenantSelector` existentes
- Reutilizar componentes UI: Card, Badge, Tabs, Progress, Dialog, Select, Switch, Skeleton
- Workspace selector para super roles segue o mesmo padrao do FW Analyzer
- Agendamento usa upsert em `m365_analyzer_schedules` com `onConflict: 'tenant_record_id'`
- Edge function trigger: `supabase.functions.invoke('trigger-m365-analyzer', { body: { tenant_record_id } })`
- Cores de severidade seguem o padrao existente (rose para critical, orange para high, warning para medium, primary para low)

