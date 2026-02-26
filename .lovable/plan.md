
## M365 Analyzer - Plano de Implementacao (Faseado)

Este e um modulo grande e complexo. Para manter qualidade e permitir validacao incremental, o plano esta dividido em **4 fases**, cada uma entregando valor funcional completo.

---

### Fase 1: Infraestrutura e Coleta (Backend)

**Objetivo:** Criar a base de dados, edge functions de trigger e processamento, e o blueprint de coleta via Graph API.

#### 1.1 Tabelas no Supabase

Criar via migration:

- **`m365_analyzer_snapshots`** -- espelho de `analyzer_snapshots` para M365
  - `id`, `tenant_record_id`, `client_id`, `status` (pending/processing/completed/failed/cancelled)
  - `period_start`, `period_end`, `score`, `summary` (jsonb), `insights` (jsonb), `metrics` (jsonb)
  - `created_at`, `agent_task_id`
  - RLS: service_role full, users SELECT via `has_client_access`

- **`m365_analyzer_schedules`** -- agendamento recorrente por tenant
  - `id`, `tenant_record_id` (UNIQUE), `frequency`, `scheduled_hour`, `scheduled_day_of_week`, `scheduled_day_of_month`
  - `is_active`, `next_run_at`, `created_by`, `created_at`, `updated_at`
  - RLS: similar a `analyzer_schedules`

- **`m365_user_baselines`** -- baseline comportamental por usuario
  - `id`, `tenant_record_id`, `user_principal_name`
  - `avg_sent_daily`, `avg_received_daily`, `avg_recipients_per_msg`, `typical_send_hours` (jsonb array)
  - `baseline_date`, `sample_days`, `updated_at`
  - RLS: service_role full, users SELECT via client access

#### 1.2 Edge Function: `trigger-m365-analyzer`

Segue o padrao de `trigger-firewall-analyzer`:
- Recebe `tenant_record_id`
- Verifica task ativa existente
- Calcula `period_start` com base no ultimo snapshot concluido (cap 2h)
- Cria snapshot em `m365_analyzer_snapshots` com status `pending`
- Cria `agent_task` do tipo `m365_analyzer` para o agent associado ao tenant
- Retorna `task_id` e `snapshot_id`

#### 1.3 Edge Function: `m365-analyzer`

Engine principal de processamento (chamada quando o agent retorna dados ou diretamente via Graph API):
- Recebe `snapshot_id`
- Busca dados do snapshot (period_start, period_end, tenant_record_id)
- Coleta dados via Graph API usando credenciais do tenant:
  - **Message Trace** (ultimas horas)
  - **Mailbox Statistics** (tamanho das caixas)
  - **Inbox Rules** (regras de redirecionamento)
  - **Sign-in Logs** (para cruzamento de geolocalizacao)
  - **Audit Logs** (criacao de regras, delegacoes)
- Processa 7 modulos de analise (detalhados abaixo)
- Calcula score, summary e metrics
- Atualiza snapshot com status `completed`

#### 1.4 Modulos de Analise (dentro da Edge Function)

Cada modulo gera insights e metricas, identico ao padrao do firewall:

| Modulo | Fontes Graph API | Insights gerados |
|--------|-----------------|------------------|
| **Phishing/Ameacas** | Message Trace (FilteredAsSpam, Quarantined), Threat Protection Status | Volume phishing 24h, usuarios mais atacados, dominios remetentes, tendencia vs hora anterior |
| **Capacidade Mailbox** | Mailbox Statistics | Caixas >80%, >90%, crescimento anormal 24h |
| **Baseline Comportamental** | Message Trace (enviados/recebidos) + `m365_user_baselines` | Desvio de media de envio (5x+), horario atipico, destinatarios em massa |
| **Comprometimento de Conta** | Sign-in Logs + Message Trace + Inbox Rules | Correlacao login suspeito + envio massivo + regra criada |
| **Regras Suspeitas** | Inbox Rules, Transport Rules | Forward externo, mover para pasta oculta, deletar automatico |
| **Exfiltracao** | Message Trace (saida) | Alto volume para dominio externo desconhecido, concentracao de anexos |
| **Outros Riscos** | Mailbox Permissions, Auth Methods, App Consent | SMTP AUTH ativo, protocolo legado, FullAccess recente, contas inativas enviando |

#### 1.5 Integracao com `run-scheduled-analyses`

Adicionar suporte ao tipo `m365_analyzer` na edge function de agendamento existente, para que `m365_analyzer_schedules` seja processada automaticamente.

---

### Fase 2: Frontend - Dashboard e Visualizacao

**Objetivo:** Criar a pagina do Analyzer M365 com cards, metricas e lista de insights.

#### 2.1 Tipos TypeScript

- **`src/types/m365AnalyzerInsights.ts`** -- tipos para snapshots, insights, metricas e summary do M365 Analyzer (seguindo padrao de `analyzerInsights.ts`)

#### 2.2 Hook de Dados

- **`src/hooks/useM365AnalyzerData.ts`** -- hook com `useLatestM365AnalyzerSnapshot` e `useM365AnalyzerProgress` (espelho de `useAnalyzerData.ts`)
  - Agrega ate 24 snapshots para visao consolidada de 24h
  - Polling de progresso a cada 10s

#### 2.3 Pagina Principal

- **`src/pages/m365/M365AnalyzerDashboardPage.tsx`**
  - Seletor de Tenant (reutiliza `TenantSelector`)
  - Cards de resumo: Volume Phishing, Mailboxes Criticas, Comportamento Anomalo, Alertas Criticos 24h
  - Tendencia comparativa (seta para cima/baixo vs snapshot anterior)
  - Secao "Top Riscos Agora" -- lista priorizada por criticidade
  - Botao "Analisar Agora" + Dialog de agendamento
  - Progresso de analise em andamento
  - Tabs por categoria de insight (Phishing, Mailbox, Comportamento, etc.)

#### 2.4 Componentes Visuais

Reutilizar ao maximo componentes existentes:
- `UnifiedComplianceCard` para cards de insight individual
- Widgets de ranking (adaptar `IPListWidget` do Analyzer FW para "Top Usuarios Atacados", "Top Dominios Remetentes")
- Badges de severidade com o padrao existente (critical/high/medium/low/info)

#### 2.5 Navegacao

- Adicionar item "Analyzer" no menu lateral do modulo `scope_m365` em `AppLayout.tsx`
- Rota: `/scope-m365/analyzer`
- Registrar em `App.tsx`

---

### Fase 3: Baseline Comportamental e Correlacao

**Objetivo:** Implementar a engine de baseline e correlacao entre eventos.

#### 3.1 Construcao de Baseline

Na edge function `m365-analyzer`:
- No primeiro snapshot, coletar historico de 24h como baseline inicial
- Calcular medias por usuario (envio, recebimento, destinatarios, horarios)
- Persistir em `m365_user_baselines`
- Em snapshots subsequentes, comparar comportamento atual vs baseline
- Atualizar baseline gradualmente (media movel ponderada)

#### 3.2 Correlacao de Eventos

Cruzamentos automaticos que geram insights consolidados:
- Login geo-suspeito + envio massivo = "Alta probabilidade de comprometimento"
- Criacao de regra forward + envio para mesmo dominio = "Possivel exfiltracao coordenada"
- Conta inativa + envio repentino = "Conta possivelmente comprometida"

#### 3.3 Comparacao Entre Snapshots

- Na UI, mostrar deltas (setas/percentuais) entre snapshot atual e anterior
- Permitir selecionar "Ultima hora" vs "Hoje vs Ontem" no dashboard

---

### Fase 4: Refinamentos e Subpaginas

**Objetivo:** Paginas de detalhe, relatorios e polimento.

#### 4.1 Subpaginas

- `/scope-m365/analyzer/insights` -- todos os insights filtrados por categoria/severidade
- `/scope-m365/analyzer/critical` -- apenas criticos/altos para acao imediata

#### 4.2 Exemplo de Insight Completo

Formato final de insight gerado:

```text
"Usuario joao@empresa.com enviou 480% mais emails que sua media diaria.
 Detectado envio para 37 destinatarios externos.
 2 horas antes houve login a partir de pais incomum (Nigeria).
 Severidade: Critica
 Recomendacao: Bloquear conta imediatamente e investigar atividade recente."
```

#### 4.3 Integracao com Relatorios PDF

Adicionar secao do M365 Analyzer ao sistema de PDF existente.

---

### Detalhes Tecnicos

#### APIs Graph Utilizadas

| Dados | Endpoint | Permissao |
|-------|----------|-----------|
| Message Trace | `/reports/getEmailActivityUserDetail` ou Exchange PS `Get-MessageTrace` | `Reports.Read.All` |
| Mailbox Stats | Exchange PS `Get-MailboxStatistics` | Exchange RBAC |
| Inbox Rules | `/users/{id}/mailFolders/inbox/messageRules` | `MailboxSettings.Read` |
| Sign-in Logs | `/auditLogs/signIns` | `AuditLog.Read.All` |
| Audit Logs | `/auditLogs/directoryAudits` | `AuditLog.Read.All` |
| Mail Activity | `/reports/getMailboxUsageDetail` | `Reports.Read.All` |

#### Prioridade de Coleta

Seguindo a constraint existente: **Graph API primeiro**, PowerShell apenas quando necessario (Mailbox Statistics, Message Trace detalhado).

#### Classificacao de Severidade

Cada insight recebe severidade baseada em:
- **Critical:** Desvio >500% do baseline OU correlacao com login suspeito OU regra de forward para dominio externo
- **High:** Desvio >200% OU mailbox >95% OU protocolo legado ativo em conta privilegiada
- **Medium:** Desvio >100% OU mailbox >80% OU SMTP AUTH habilitado
- **Low/Info:** Tendencias e observacoes informativas

---

### Ordem de Implementacao Sugerida

**Fase 1** e a mais complexa (backend), mas e pre-requisito para tudo. Sugiro comecar por ela. A Fase 2 pode ser iniciada em paralelo com dados mockados enquanto o backend e finalizado.

As Fases 3 e 4 sao incrementais e podem ser entregues apos validacao das fases iniciais.

### Arquivos Impactados (Resumo)

| Fase | Arquivos Novos | Arquivos Modificados |
|------|---------------|---------------------|
| 1 | `supabase/functions/trigger-m365-analyzer/index.ts`, `supabase/functions/m365-analyzer/index.ts`, migration SQL | `supabase/config.toml`, `supabase/functions/run-scheduled-analyses/index.ts` |
| 2 | `src/types/m365AnalyzerInsights.ts`, `src/hooks/useM365AnalyzerData.ts`, `src/pages/m365/M365AnalyzerDashboardPage.tsx` | `src/App.tsx`, `src/components/layout/AppLayout.tsx` |
| 3 | -- | `supabase/functions/m365-analyzer/index.ts` (baseline engine) |
| 4 | `src/pages/m365/M365AnalyzerInsightsPage.tsx`, `src/pages/m365/M365AnalyzerCriticalPage.tsx` | `src/App.tsx` |
