

# Analyzer - Firewall Security Intelligence

## Visao Geral

Submódulo de inteligência de segurança para firewalls que coleta logs filtrados via API FortiGate, processa na nuvem (Edge Function) e apresenta insights executivos com drill-down técnico. Nenhum log bruto é exibido -- apenas insights classificados por criticidade.

## Arquitetura

O Analyzer segue o mesmo padrão existente de Blueprint + Agent + Edge Function usado nos módulos de Compliance e M365 Posture:

```text
FortiGate API ──> Agent Python ──> Edge Function ──> Supabase DB ──> Frontend
  (logs filtrados)   (coleta)       (processamento)    (insights)     (dashboard)
```

### Fluxo de Dados

1. Um Blueprint "Analyzer" define os steps de coleta (endpoints de log do FortiGate)
2. O Agent executa os steps via `http_request` executor (já existente), coletando logs filtrados
3. Os resultados dos steps são enviados progressivamente via `agent-step-result` (já existente)
4. Ao completar a task, `agent-task-result` chama uma nova função de processamento que gera insights
5. Os insights são salvos na tabela `analyzer_snapshots`
6. O frontend exibe o dashboard executivo e drill-down

### Estratégia de Volume (~12.8M logs/dia)

O FortiGate API suporta filtros nativos (`filter=action==deny`, `rows=1000`, `start=<timestamp>`). Os steps do Blueprint farão queries filtradas por categoria, coletando apenas os dados relevantes para cada módulo de análise (top IPs bloqueados, falhas de VPN, eventos IPS Critical/High, etc.). Isso reduz drasticamente o volume enviado ao servidor.

---

## Fase 1: Fundação + 3 Módulos de Análise

### Banco de Dados

**Nova tabela: `analyzer_snapshots`**

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| firewall_id | uuid (FK) | Referência ao firewall |
| client_id | uuid | Workspace para RLS |
| agent_task_id | uuid | Task que gerou o snapshot |
| status | text | pending / processing / completed / failed |
| period_start | timestamptz | Inicio do periodo analisado |
| period_end | timestamptz | Fim do periodo analisado |
| score | integer | Score geral de risco (0-100, invertido: 100 = seguro) |
| summary | jsonb | Contadores por severidade (critical, high, medium, low, info) |
| insights | jsonb | Array de insights estruturados |
| metrics | jsonb | Métricas agregadas (top IPs, top paises, volumes) |
| created_at | timestamptz | Timestamp de criacao |

Politicas RLS: mesma estrutura das tabelas `analysis_history` (acesso via `has_client_access`).

**Nova tabela: `analyzer_schedules`** (mesma estrutura de `analysis_schedules`)

| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| firewall_id | uuid |
| frequency | schedule_frequency |
| scheduled_hour | integer |
| is_active | boolean |
| next_run_at | timestamptz |

### Blueprint (via banco - Administracao > Templates)

Será criado um novo Blueprint para o device type "FortiGate" com `executor_type = 'hybrid'` e os seguintes steps de coleta:

```text
Step 1: denied_traffic
  GET /api/v2/log/traffic/forward?filter=action==deny&rows=500&start=<12h_ago>
  
Step 2: auth_events  
  GET /api/v2/log/event/system?filter=logdesc==*auth*&rows=500&start=<12h_ago>

Step 3: vpn_events
  GET /api/v2/log/event/vpn?rows=500&start=<12h_ago>

Step 4: ips_events
  GET /api/v2/log/ips/forward?filter=severity<=2&rows=500&start=<12h_ago>

Step 5: dns_events
  GET /api/v2/log/dns?rows=500&start=<12h_ago>

Step 6: config_changes
  GET /api/v2/log/event/system?filter=logdesc==*config*&rows=200&start=<24h_ago>

Step 7: traffic_stats
  GET /api/v2/monitor/firewall/statistics (sessoes, bandwidth)
```

Estes steps serão inseridos via SQL na tabela `device_blueprints` e poderão ser editados pela interface de Templates existente.

### Edge Function: `firewall-analyzer`

Nova Edge Function que:
1. Recebe os dados coletados pelo agent (chamada pelo `agent-task-result` quando `task_type = 'firewall_analyzer'`)
2. Processa cada categoria de log e gera insights estruturados
3. Calcula métricas agregadas (top IPs, top paises, volumes)
4. Classifica cada insight por severidade usando thresholds configuráveis
5. Calcula score geral de risco
6. Salva o snapshot na tabela `analyzer_snapshots`

**Módulos de análise implementados na Fase 1:**

**1. Denied Traffic Intelligence**
- Agrupa tentativas por IP de origem
- Detecta port scan (IPs tentando multiplas portas)
- Identifica tentativas em portas sensíveis (3389, 22, 445, 1433, etc.)
- Calcula frequência e classifica: repetição > threshold = High, port scan = Critical

**2. Autenticação (VPN/SSL VPN)**
- Agrupa falhas de login por usuario
- Detecta brute force (>N falhas em M minutos)
- Identifica login admin via WAN (Critical)
- Login fora de horario comercial

**3. IPS/IDS Intelligence**
- Filtra eventos Critical e High
- Detecta padrões C2 (Critical)
- Agrupa por tipo de ataque
- Identifica hosts internos afetados

### Edge Function: `trigger-firewall-analyzer`

Semelhante ao `trigger-firewall-analysis`, cria uma task do tipo `firewall_analyzer` para o agent, referenciando o Blueprint do Analyzer.

### Atualizacao do `agent-task-result`

Adicionar um branch para `task_type === 'firewall_analyzer'` que:
1. Coleta os step results da tabela `task_step_results`
2. Chama a função de processamento do `firewall-analyzer`
3. Salva o resultado em `analyzer_snapshots`

### Atualizacao do `run-scheduled-analyses`

Adicionar suporte para `analyzer_schedules` (mesma lógica já usada para firewalls e domínios externos).

### Frontend

**Novas paginas:**

**`/scope-firewall/analyzer` - Dashboard Executivo**
- Cards de severidade: Critical, High, Medium, Low (últimas 12h)
- Widgets:
  - Top 10 IPs bloqueados (tabela com IP, pais, contagem, portas alvo)
  - Top paises com tentativas
  - Volume de falhas VPN (mini chart)
  - Eventos IPS Critical/High (lista)
  - Alteracoes de configuracao (timeline)
- Filtro por periodo: 12h / 24h
- Botao "Executar Análise" para trigger manual

**`/scope-firewall/analyzer/insights` - Drill-down Técnico**
- Lista de insights agrupados por categoria
- Cada insight exibe: titulo, descricao, severidade, detalhes técnicos (expandível)
- Filtro por severidade e categoria

**`/scope-firewall/analyzer/critical` - Monitoramento Critico**
- Aba focada apenas nos itens de maior risco:
  - Logins admin via WAN
  - Brute force VPN
  - IPS Critical
  - Port scan confirmado
  - Alteracoes de configuracao

**Atualizacao do menu lateral:**
- Adicionar "Analyzer" como submenu do Scope Firewall no `AppLayout.tsx`

**Atualizacao de rotas:**
- Adicionar rotas `/scope-firewall/analyzer`, `/scope-firewall/analyzer/insights`, `/scope-firewall/analyzer/critical` no `App.tsx`

### Tipos TypeScript

```text
src/types/analyzerInsights.ts

- AnalyzerInsight (id, category, name, description, severity, details, sourceIPs, etc.)
- AnalyzerSnapshot (id, firewall_id, score, summary, insights[], metrics)
- AnalyzerMetrics (topBlockedIPs, topCountries, vpnFailures, ipsEvents, etc.)
```

### Hook

```text
src/hooks/useAnalyzerData.ts

- Busca snapshots de analyzer_snapshots
- Filtra por firewall_id e periodo
- Retorna insights, metricas e score
```

---

## Fase 2 (Futura)

Módulos adicionais que seguirão o mesmo padrão:
- DNS Security Intelligence
- Alteracoes de Configuracao (com timeline)
- Trafego Lateral
- Sessoes Persistentes
- Comportamento de Tráfego (baseline 7/30 dias)
- Geolocalizacao
- IoC Correlation (integração com feeds externos)

---

## Resumo de Arquivos

### Novos
| Arquivo | Descricao |
|---------|-----------|
| `src/types/analyzerInsights.ts` | Tipos TypeScript |
| `src/hooks/useAnalyzerData.ts` | Hook de dados |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Dashboard executivo |
| `src/pages/firewall/AnalyzerInsightsPage.tsx` | Drill-down técnico |
| `src/pages/firewall/AnalyzerCriticalPage.tsx` | Monitoramento critico |
| `supabase/functions/firewall-analyzer/index.ts` | Processamento de insights |
| `supabase/functions/trigger-firewall-analyzer/index.ts` | Trigger manual |

### Modificados
| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | 3 novas rotas |
| `src/components/layout/AppLayout.tsx` | Menu "Analyzer" no sidebar |
| `supabase/functions/agent-task-result/index.ts` | Branch para firewall_analyzer |
| `supabase/functions/run-scheduled-analyses/index.ts` | Suporte a analyzer_schedules |
| `supabase/config.toml` | Novas Edge Functions |

### Migracao SQL
- Criar tabelas `analyzer_snapshots` e `analyzer_schedules`
- Inserir Blueprint "Analyzer" na tabela `device_blueprints`
- RLS policies para ambas as tabelas

**Nenhuma nova dependencia NPM necessaria.**
