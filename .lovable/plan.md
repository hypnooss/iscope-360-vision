

## Diagnóstico: Cache vs Snapshots — Arquitetura de Período Dinâmico

### Problema

Os dashboards (Exchange, Entra ID, Colaboração) salvam KPIs numa **única coluna JSONB** (`exchange_dashboard_cache`, etc.) que é sobrescrita a cada execução. Quando o usuário selecionar "7 dias" no futuro, essa coluna terá apenas o último resultado — não haverá dados históricos para agregar.

### Análise dos Dados

As edge functions coletam **dois tipos de dados**:

| Tipo | Exemplos | Natureza |
|------|----------|----------|
| **Estado** (point-in-time) | Total mailboxes, MFA enabled/disabled, users count, risky users, over quota | Sempre o mais recente. Não agrega. |
| **Evento** (time-windowed) | Traffic sent/received, phishing blocked, spam, sign-in logs, audit logs | Precisa agregar por período. |

A `exchange-dashboard` já agrega traffic e security **a partir dos `m365_analyzer_snapshots`**. Ou seja, os dados de evento já estão nos snapshots — o cache é redundante para eles.

### Solução Proposta

Criar uma tabela `m365_dashboard_snapshots` que armazena os resultados de cada execução das edge functions de dashboard, com `period_start` e `period_end`, seguindo o mesmo padrão de `m365_analyzer_snapshots`.

**1. Nova tabela: `m365_dashboard_snapshots`**

```sql
CREATE TABLE m365_dashboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_record_id uuid REFERENCES m365_tenants(id) ON DELETE CASCADE NOT NULL,
  client_id uuid REFERENCES clients(id),
  dashboard_type text NOT NULL, -- 'entra_id', 'exchange', 'collaboration'
  data jsonb NOT NULL DEFAULT '{}',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_dash_snap_tenant_type ON m365_dashboard_snapshots(tenant_record_id, dashboard_type, created_at DESC);
```

**2. Edge Functions** (`exchange-dashboard`, `entra-id-dashboard`, `collaboration-dashboard`)

Em vez de `UPDATE m365_tenants SET exchange_dashboard_cache = ...`, fazer `INSERT INTO m365_dashboard_snapshots` com o `dashboard_type` correspondente e os `period_start`/`period_end` da janela coletada.

Manter os campos de cache nas `m365_tenants` como "latest snapshot" para carregamento instantâneo (cache-first).

**3. Frontend Hooks** (`useExchangeDashboard`, `useEntraIdDashboard`, `useCollaborationDashboard`)

- **Estado** (mailboxes, MFA, users): sempre do **último** snapshot do tipo correspondente
- **Eventos** (traffic, security, logins): agregar de **todos os snapshots** dentro do período selecionado

Atualmente usam `loadCache()` que lê da coluna JSONB. Mudar para consultar `m365_dashboard_snapshots` filtrado por `dashboard_type` e período.

**4. Limpeza futura**

As colunas `exchange_dashboard_cache`, `entra_dashboard_cache`, `collaboration_dashboard_cache` e seus `*_cached_at` podem ser removidas quando a migração estiver completa.

### Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Criar tabela `m365_dashboard_snapshots` com RLS |
| `supabase/functions/exchange-dashboard/index.ts` | INSERT snapshot + UPDATE cache (backward compat) |
| `supabase/functions/entra-id-dashboard/index.ts` | INSERT snapshot + UPDATE cache |
| `supabase/functions/collaboration-dashboard/index.ts` | INSERT snapshot + UPDATE cache |
| `src/hooks/useExchangeDashboard.ts` | Carregar do último snapshot; agregar eventos por período |
| `src/hooks/useEntraIdDashboard.ts` | Idem |
| `src/hooks/useCollaborationDashboard.ts` | Idem |

### Benefício Imediato

Mesmo sem o seletor de período no frontend (que virá depois), os dados já estarão sendo persistidos por execução. Quando o seletor for adicionado, basta passar o período para os hooks e a agregação já funciona.

