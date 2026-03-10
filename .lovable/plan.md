

## Plano: Preferências de Notificação na página Minha Conta

### Contexto

Os alertas do sistema (`system_alerts`) possuem diferentes `alert_type`s que determinam o banner exibido no topo. Os tipos identificados são:

- `m365_analyzer_critical` — Incidentes críticos do M365 Analyzer
- `m365_*` (outros) — Alertas gerais M365 (sync, configuração)
- `firewall_analysis_completed` — Análise de firewall concluída
- `external_domain_analysis_completed` — Análise de domínio externo concluída
- `attack_surface_*` — Alertas de superfície de ataque

Atualmente não existe nenhuma tabela ou mecanismo de preferência de notificação.

### O que será feito

#### 1. Criar tabela `notification_preferences` no Supabase

```sql
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  m365_analyzer_critical boolean not null default true,
  m365_general boolean not null default true,
  firewall_analysis boolean not null default true,
  external_domain_analysis boolean not null default true,
  attack_surface boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.notification_preferences enable row level security;

create policy "Users can read own preferences"
  on public.notification_preferences for select
  to authenticated using (auth.uid() = user_id);

create policy "Users can insert own preferences"
  on public.notification_preferences for insert
  to authenticated with check (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.notification_preferences for update
  to authenticated using (auth.uid() = user_id);
```

#### 2. Criar componente `NotificationPreferences`

Novo arquivo `src/components/account/NotificationPreferences.tsx`:

- Card com ícone `Bell` e título "Preferências de Notificação"
- Descrição: "Personalize quais alertas você deseja receber no banner do sistema."
- Lista de switches (usando o componente `Switch` existente) para cada categoria:
  - **Incidentes Críticos M365** — Alertas de incidentes críticos detectados pelo Analyzer
  - **Alertas Gerais M365** — Notificações de sincronização e configuração do M365
  - **Análise de Firewall** — Alertas quando análises de firewall são concluídas
  - **Análise de Domínio Externo** — Alertas quando análises de domínios externos são concluídas
  - **Superfície de Ataque** — Alertas de monitoramento de superfície de ataque
- Carrega preferências do Supabase no mount (upsert com defaults se não existir)
- Salva automaticamente ao alternar cada switch (com debounce)

#### 3. Integrar na `AccountPage.tsx`

Adicionar o card `NotificationPreferences` abaixo do grid de 2 colunas existente, ocupando a largura total.

#### 4. Filtrar alertas com base nas preferências

Em `SystemAlertBanner.tsx`:
- Buscar as preferências do usuário junto com os alertas
- Filtrar `visibleAlerts` removendo os tipos que o usuário desabilitou
- Mapeamento: `m365_analyzer_critical` → flag `m365_analyzer_critical`, `m365_*` → `m365_general`, `firewall_*` → `firewall_analysis`, `external_domain_*` → `external_domain_analysis`, `attack_surface_*` → `attack_surface`

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/account/NotificationPreferences.tsx` | Criar |
| `src/pages/AccountPage.tsx` | Adicionar componente |
| `src/components/alerts/SystemAlertBanner.tsx` | Filtrar alertas por preferências |
| Supabase (SQL) | Criar tabela + RLS |
| `src/integrations/supabase/types.ts` | Regenerado automaticamente |

