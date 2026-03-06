

## Falso Positivo / Ocultar Incidente na Proteção contra Ameaças

### Objetivo

Permitir que o usuário marque itens dos rankings (domínios de SPAM, alvos de phishing, fontes de malware) como "Falso Positivo" diretamente no ThreatDetailSheet. Itens marcados serão ocultados dos rankings e, se o mesmo item aparecer em coletas futuras, continuará oculto. Um aviso claro indicará que isso é apenas visual na plataforma e não altera nada no Microsoft 365.

### Alterações

**1. Nova tabela: `m365_threat_dismissals`**

Armazena os itens suprimidos por tenant, com chave composta `tenant_record_id + type + label` para deduplicação entre coletas.

```sql
create table public.m365_threat_dismissals (
  id uuid primary key default gen_random_uuid(),
  tenant_record_id uuid not null references m365_tenants(id) on delete cascade,
  type text not null,          -- 'spam' | 'phishing' | 'malware'
  label text not null,         -- domain or user
  dismissed_by uuid not null,
  reason text,                 -- optional user note
  created_at timestamptz not null default now(),
  unique (tenant_record_id, type, label)
);
alter table public.m365_threat_dismissals enable row level security;
-- RLS: users with client access can read/insert/delete
```

**2. Hook: `src/hooks/useThreatDismissals.ts`** (novo)

- Query dismissals for the current tenant
- Mutations: `dismiss(type, label, reason?)` and `restore(type, label)`
- Returns a `Set<string>` of dismissed keys (`type::label`) for fast lookup

**3. Componente: `ThreatDetailSheet.tsx`**

- Add a "Marcar como Falso Positivo" button with optional reason input
- Show warning banner: "Esta ação é apenas na plataforma iScope e não altera configurações no Microsoft 365"
- If already dismissed, show "Restaurar" button instead

**4. Componente: `ThreatProtectionTab.tsx`**

- Receive `dismissedKeys` set from parent
- Filter ranking items: hide those in `dismissedKeys`
- Add a toggle "Mostrar ocultos" to optionally show dismissed items with visual indicator (strikethrough/opacity)
- Adjust KPI counts to subtract dismissed items

**5. Dashboard: `M365AnalyzerDashboardPage.tsx`**

- Call `useThreatDismissals(tenantId)` and pass `dismissedKeys` to `ThreatProtectionTab`

### Arquivos

1. Migration SQL — nova tabela `m365_threat_dismissals` + RLS
2. `src/hooks/useThreatDismissals.ts` — novo hook
3. `src/components/m365/analyzer/ThreatDetailSheet.tsx` — botão falso positivo
4. `src/components/m365/analyzer/ThreatProtectionTab.tsx` — filtrar dismissed
5. `src/pages/m365/M365AnalyzerDashboardPage.tsx` — integrar hook

