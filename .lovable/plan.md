1: # Status: ✅ Implementado

## Centralização de Timezone — America/Sao_Paulo (UTC-3)

### Problema resolvido
Todas as datas do sistema agora são exibidas no fuso **America/Sao_Paulo**, independente do fuso do browser do usuário. O agendamento também converte corretamente a hora selecionada (BRT) para UTC.

### Mudanças implementadas

| Componente | Mudança |
|---|---|
| `src/lib/dateUtils.ts` | Novo arquivo com helpers centralizados (`formatDateTimeBR`, `formatDateTimeFullBR`, `formatShortDateTimeBR`, `formatDateOnlyBR`, `formatDateLongBR`, `formatDateTimeLongBR`, `formatDateTimeMediumBR`, `toBRT`) |
| `ScheduleDialog.tsx` | `calculateNextRun` converte hora BRT→UTC; label simplificado |
| `run-scheduled-analyses` Edge Function | `calculateNextRunAt` converte hora BRT→UTC; suporta `next_run_at` NULL para recálculo sem disparo |
| ~30 arquivos .tsx | Todas as chamadas `toLocaleString('pt-BR')` e `format(new Date(...))` substituídas por helpers com timezone fixo |

## Correção de Dados — scheduled_hour UTC→BRT

### Problema resolvido
Os valores `scheduled_hour` existentes nas tabelas de agendamento estavam em UTC (sistema antigo). Com a correção de timezone, passaram a ser interpretados como BRT, causando deslocamento de +3h.

### Solução aplicada
1. **Migration**: Subtraiu 3h de todos os `scheduled_hour` em 6 tabelas (`analysis_schedules`, `analyzer_schedules`, `m365_compliance_schedules`, `m365_analyzer_schedules`, `attack_surface_schedules`, `external_domain_schedules`)
2. **Edge Function**: Adicionado suporte a `next_run_at IS NULL` — recalcula sem disparar análise
3. **Recálculo**: Todos os `next_run_at` foram recalculados corretamente

## Paralelização do run-scheduled-analyses

### Problema resolvido
A Edge Function processava 6 seções sequencialmente (~140 agendamentos). Com o timeout da função, seções finais (M365 Compliance) nunca eram alcançadas nos horários de pico.

### Solução aplicada
Refatoração para processar todas as 6 seções em **paralelo** com `Promise.all`:
- `processFirewallComplianceSchedules`
- `processExternalDomainSchedules`
- `processAnalyzerSchedules`
- `processAttackSurfaceSchedules`
- `processM365AnalyzerSchedules`
- `processM365ComplianceSchedules`

CVE refresh continua sequencial (após o Promise.all). Cada função retorna `{ triggered, skipped, errors, total }` para o log de breakdown.

## Timezone Dinâmico — Preferência do Usuário

### Problema resolvido
O sistema hardcodava `America/Sao_Paulo` em toda exibição e conversão de datas. Usuários em outros fusos viam horários incorretos e agendamentos eram sempre convertidos com offset fixo de +3.

### Solução implementada

| Componente | Mudança |
|---|---|
| **Migration SQL** | Adicionada coluna `timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo'` em 6 tabelas de agendamento |
| `src/lib/dateUtils.ts` | Substituído `TZ` hardcoded por getter/setter dinâmico (`setUserTimezone`/`getUserTimezone`). Adicionado `getUtcOffsetHours()` para conversão dinâmica. `toBRT` renomeado para `toUserTZ` (alias mantido) |
| `src/contexts/AuthContext.tsx` | Chama `setUserTimezone(profile.timezone)` ao carregar perfil (incluindo cache) |
| `ScheduleDialog.tsx` | Conversão hora→UTC usa offset dinâmico do timezone do usuário. Salva `timezone` no payload do upsert |
| `run-scheduled-analyses` Edge Function | `calculateNextRunAt` recebe `timezone` de cada schedule e calcula offset via `Intl.DateTimeFormat` |
| **33 arquivos consumidores** | Nenhuma mudança necessária — assinaturas das funções format não mudaram |

### Arquitetura

```text
┌─────────────────────────────────────────────────────┐
│  Banco: tudo em UTC + coluna timezone por schedule  │
├─────────────────────────────────────────────────────┤
│  Frontend: dateUtils usa timezone do perfil         │
│  ScheduleDialog: converte dinamicamente para UTC    │
├─────────────────────────────────────────────────────┤
│  Edge Function: lê timezone de cada registro        │
│  e calcula offset via Intl.DateTimeFormat           │
└─────────────────────────────────────────────────────┘
```

## Correção de Dados Duplicados — Exchange Analyzer

### Status: ✅ Implementado

### Problema resolvido
O Exchange Analyzer usava janelas temporais fixas de 24h tanto no PowerShell (blueprint) quanto nas queries Graph API (edge function), causando sobreposição de dados entre snapshots consecutivos e contagem duplicada de eventos.

### Mudanças implementadas

| Componente | Mudança |
|---|---|
| **Blueprint `m365` (hybrid)** | Comando `exo_message_trace` alterado de `-StartDate (Get-Date).AddHours(-24)` para `-StartDate "{period_start}" -EndDate "{period_end}"`, usando os valores do payload da task |
| **`supabase/functions/m365-analyzer/index.ts`** | Duas janelas fixas de 24h (fallback Graph API ~linha 2147 e enriquecimento ~linha 2197) substituídas por `snapshot.period_start`/`period_end` com fallback para 24h se ausentes. Filtro `createdDateTime le` adicionado para limite superior |
| **Frontend** | Sem alteração necessária — agregação já funciona corretamente com snapshots não-sobrepostos |

### Arquitetura final
```text
trigger-m365-analyzer:
  period_start = last_snapshot.period_end (ou now - 2h)
  period_end = now
  → Cria snapshot + agent_task com period_start/period_end no payload

Blueprint (PowerShell):
  Get-MessageTraceV2 -StartDate "{period_start}" -EndDate "{period_end}"
  → Agente interpola placeholders do payload

Edge Function (Graph API):
  $filter=createdDateTime ge {period_start} and createdDateTime le {period_end}
  → Usa snapshot.period_start/period_end

Frontend (useM365AnalyzerData.ts):
  Soma contadores de snapshots consecutivos sem sobreposição
  → Dados precisos sem duplicação
```

## Dashboard Snapshots — Arquitetura de Período Dinâmico

### Status: ✅ Implementado

### Problema resolvido
Os dashboards operacionais (Exchange, Entra ID, Colaboração) salvavam KPIs numa única coluna JSONB sobrescrita a cada execução, impedindo agregação histórica para períodos dinâmicos (7 dias, 30 dias, etc.).

### Mudanças implementadas

| Componente | Mudança |
|---|---|
| **Migration SQL** | Nova tabela `m365_dashboard_snapshots` com `tenant_record_id`, `client_id`, `dashboard_type`, `data` (JSONB), `period_start`, `period_end`, `created_at`. RLS com service_role, client_access e super_admin |
| `exchange-dashboard` Edge Function | INSERT snapshot em `m365_dashboard_snapshots` (type='exchange') + UPDATE cache legado |
| `entra-id-dashboard` Edge Function | INSERT snapshot (type='entra_id') + UPDATE cache legado |
| `collaboration-dashboard` Edge Function | INSERT snapshot (type='collaboration') + UPDATE cache legado |
| `useExchangeDashboard.ts` | Carrega do último snapshot da nova tabela, fallback para cache legado |
| `useEntraIdDashboard.ts` | Idem |
| `useCollaborationDashboard.ts` | Idem |

### Próximos passos
- Adicionar seletor de período no frontend e agregar dados de evento de múltiplos snapshots
- Auto-trigger dos dashboards no `agent-task-result` ao completar task m365_analyzer
- Remover colunas de cache legado quando migração estiver consolidada

## StorageQuota SharePoint via Agent PowerShell

### Status: ✅ Implementado

### Problema resolvido
A REST API do SPO Admin (`/_api/StorageQuota()`) frequentemente falha por falta de permissões. O comando PowerShell `Get-PnPTenant | Select StorageQuota` é confiável e retorna o valor em MB.

### Mudanças implementadas

| Componente | Mudança |
|---|---|
| `python-agent/agent/executors/powershell.py` | Novo módulo `PnP.PowerShell` no dict `MODULES` com suporte a CBA via thumbprint. Params `spo_admin_domain` e `thumbprint` adicionados a todos os `.format()` de conexão |
| Blueprint M365 hybrid (DB) | Novo step `spo_tenant_quota` (optional) usando `PnP.PowerShell` com comando `Get-PnPTenant \| Select StorageQuota, StorageQuotaAllocated` |
| `collaboration-dashboard` Edge Function | Busca quota do agent (`step_results.spo_tenant_quota`) antes do fallback REST API. Converte MB→bytes |

### Fluxo
```text
Agent (PnP.PowerShell) → Get-PnPTenant → StorageQuota (MB)
  ↓ salvo em step_results do agent_task
collaboration-dashboard → lê step_results do último snapshot completed
  → storageAllocatedBytes = quotaMB * 1024 * 1024
  → fallback: REST API SPO Admin (se agent não coletou)
```

## Correção do `spo_tenant_quota` — URL admin incorreta

### Status: ✅ Implementado

### Problema resolvido
O campo `tenant_domain` armazenava domínios como `deployitgroup.mail.onmicrosoft.com`, mas a lógica de derivação do SPO admin URL não removia `.mail`, gerando URLs incorretas.

### Mudanças implementadas

| Componente | Mudança |
|---|---|
| **Migration SQL** | Adicionada coluna `spo_domain TEXT` em `m365_tenants` para armazenar o prefixo SPO explícito (ex: `precisioglobal`) |
| **`rpc_get_agent_tasks`** | Incluído `spo_domain` no payload `target` para tasks M365 |
| `python-agent/agent/tasks.py` | Inclui `spo_domain` no contexto M365 do agente |
| `python-agent/agent/executors/powershell.py` | Novo método `_derive_spo_domain()` com prioridade: `spo_domain` explícito > derivação de `organization`. Todas as 6 derivações corrigidas para remover `.mail` |
| `connect-m365-tenant` Edge Function | `fetchOrganizationInfo` extrai `spoDomain` de `verifiedDomains` (domínio `.onmicrosoft.com` sem `.mail`). Salva em `spo_domain` no INSERT |

### Fluxo
```text
Onboarding (connect-m365-tenant):
  GET /organization → verifiedDomains → encontra *.onmicrosoft.com (sem .mail)
  → Extrai prefixo → salva em m365_tenants.spo_domain

Agent (rpc_get_agent_tasks):
  target.spo_domain → contexto → _derive_spo_domain(organization, spo_domain)
  → Prioriza spo_domain explícito, fallback para derivação corrigida

PowerShell:
  Connect-PnPOnline -Url "https://{spo_domain}-admin.sharepoint.com" ...
  → URL correta para Get-PnPTenant
```
