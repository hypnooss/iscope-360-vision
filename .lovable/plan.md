

## Plano: Dashboard Exchange Online + Seção Colaboração (Teams & SharePoint)

### Objetivo

Transformar a página Exchange Online em um dashboard operacional rico (mesmo padrão do Entra ID com cache). Adicionar uma nova página "Colaboração" que combina Teams e SharePoint em uma única visão, já que ambos têm poucas métricas.

### Estrutura do Menu

O menu M365 ficará:
- Compliance
- Analyzer
- CVEs
- Entra ID
- Exchange Online (dashboard operacional)
- **Colaboração** (Teams + SharePoint juntos)
- Saúde do 365
- Execuções

### Arquitetura (reutiliza padrão Entra ID)

Cada produto terá edge function + cache no banco + hook com `loadCache`/`refresh`.

### 1. Migração SQL

```sql
ALTER TABLE m365_tenants ADD COLUMN IF NOT EXISTS exchange_dashboard_cache jsonb;
ALTER TABLE m365_tenants ADD COLUMN IF NOT EXISTS exchange_dashboard_cached_at timestamptz;
ALTER TABLE m365_tenants ADD COLUMN IF NOT EXISTS collaboration_dashboard_cache jsonb;
ALTER TABLE m365_tenants ADD COLUMN IF NOT EXISTS collaboration_dashboard_cached_at timestamptz;
```

### 2. Edge Functions

**`exchange-dashboard/index.ts`** — Agrega dados do Graph API:
- `/reports/getMailboxUsageDetail` — Total Mailboxes, Over Quota
- `/reports/getEmailActivityCounts(period='D30')` — Sent/Received
- Forwarding rules, auto-reply external

**`collaboration-dashboard/index.ts`** — Agrega dados do Graph API:
- Teams: `/groups?$filter=resourceProvisioningOptions/any(x:x eq 'Team')` — Total, Public, Private
- Teams com Guests
- SharePoint: `/sites?$top=999` — Total Sites
- `/reports/getSharePointSiteUsageDetail` — Inactive sites

Ambas salvam cache no banco antes de retornar.

### 3. Hooks

- `src/hooks/useExchangeDashboard.ts` — mesmo padrão do `useEntraIdDashboard`
- `src/hooks/useCollaborationDashboard.ts` — mesmo padrão

### 4. Componentes Compartilhados

Mover `EntraIdStatsCard` e `EntraIdDonutChart` para `src/components/m365/shared/` renomeando para `M365StatsCard` e `M365DonutChart`. Atualizar imports no `EntraIdPage`.

### 5. Páginas

**`ExchangeOnlinePage.tsx`** — Reescrever como dashboard operacional:
- Card "Mailboxes" (Total, Over Quota, Forwarding Enabled)
- Donut "Tráfego de Email" (Enviados/Recebidos)
- Card "Segurança" (Malicious Emails, Auto-Reply External)

**`src/pages/m365/CollaborationPage.tsx`** — Nova página com 2 seções:
- **Teams**: Card métricas (Total, Public, Private, com Guests) + Donut visibilidade
- **SharePoint**: Card métricas (Total Sites, Inactive, External Sharing)

### 6. Rotas e Menu

- `App.tsx`: Adicionar rota `/scope-m365/collaboration`
- `AppLayout.tsx`: Substituir "Exchange Online" por manter e adicionar "Colaboração" com ícone `Users`
- `supabase/config.toml`: Registrar novas edge functions

### Arquivos

| Ação | Arquivo |
|---|---|
| Migração | `supabase/migrations/xxx_product_dashboard_caches.sql` |
| Nova Edge Function | `supabase/functions/exchange-dashboard/index.ts` |
| Nova Edge Function | `supabase/functions/collaboration-dashboard/index.ts` |
| Novo Hook | `src/hooks/useExchangeDashboard.ts` |
| Novo Hook | `src/hooks/useCollaborationDashboard.ts` |
| Mover/Renomear | `EntraIdStatsCard` → `src/components/m365/shared/M365StatsCard.tsx` |
| Mover/Renomear | `EntraIdDonutChart` → `src/components/m365/shared/M365DonutChart.tsx` |
| Reescrever | `src/pages/m365/ExchangeOnlinePage.tsx` |
| Nova Página | `src/pages/m365/CollaborationPage.tsx` |
| Atualizar | `src/pages/m365/EntraIdPage.tsx` (imports) |
| Atualizar | `src/App.tsx` (rota) |
| Atualizar | `src/components/layout/AppLayout.tsx` (menu) |
| Atualizar | `supabase/config.toml` |

