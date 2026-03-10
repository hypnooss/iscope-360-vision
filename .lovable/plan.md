

## Plano: Corrigir badges de Conformidade e link de CVEs no card Domínio Externo do Dashboard

### Problemas identificados

1. **Badges de Conformidade sempre "Nenhum alerta"**: A RPC `get_ext_domain_dashboard_summary` tenta ler `report_data->'summary'->>'critical'`, mas esse campo não existe no `report_data`. A estrutura real usa `report_data->'categories'` (objeto com arrays de checks contendo `status` e `severity`). A RPC do Firewall já foi corrigida na migração `20260213234225` para iterar checks, mas a do Domínio Externo ficou desatualizada.

2. **Botão CVEs não aparece**: Em `useDashboardStats.ts` (linhas 284-286), o mapeamento de `module_code` para `statsKey` só contempla `firewall` e `m365`. O código `external_domain` nunca é mapeado para `externalDomain`, fazendo com que `cveSeverities` nunca seja preenchido e o botão "CVEs" não seja renderizado.

### Mudanças

#### 1. Migração SQL — Atualizar RPC `get_ext_domain_dashboard_summary`

Recriar a função usando a mesma abordagem da RPC do firewall: iterar `jsonb_each(report_data->'categories')` e contar checks com `status='fail'` por severidade.

```sql
CREATE OR REPLACE FUNCTION public.get_ext_domain_dashboard_summary(p_domain_ids uuid[])
RETURNS TABLE(domain_id uuid, score integer, critical integer, high integer, medium integer, low integer, analyzed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    sub.domain_id, sub.score,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='critical' THEN 1 ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='high' THEN 1 ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='medium' THEN 1 ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='low' THEN 1 ELSE 0 END), 0)::integer,
    sub.created_at
  FROM (
    SELECT DISTINCT ON (ah.domain_id)
      ah.domain_id, ah.score::integer, ah.report_data, ah.created_at
    FROM external_domain_analysis_history ah
    WHERE ah.domain_id = ANY(p_domain_ids) AND ah.status = 'completed'
    ORDER BY ah.domain_id, ah.created_at DESC
  ) sub
  LEFT JOIN LATERAL (
    SELECT jsonb_array_elements(cat_value) AS chk
    FROM jsonb_each(sub.report_data->'categories') AS cats(cat_key, cat_value)
  ) c ON true
  GROUP BY sub.domain_id, sub.score, sub.created_at;
$$;
```

#### 2. `src/hooks/useDashboardStats.ts` — Adicionar mapeamento `external_domain`

Na seção de CVE severity cache (linha ~284), adicionar `external_domain` → `externalDomain`:

```tsx
const statsKey = row.module_code === 'firewall' ? 'firewall'
  : row.module_code === 'm365' ? 'm365'
  : row.module_code === 'external_domain' ? 'externalDomain'
  : null;
```

E remover o filtro de `client_id` que só se aplica a firewall, expandindo para incluir `external_domain`:

```tsx
if ((row.module_code === 'firewall' || row.module_code === 'external_domain') && row.client_id) {
```

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| Nova migração SQL | Recriar RPC `get_ext_domain_dashboard_summary` |
| `src/hooks/useDashboardStats.ts` | Adicionar mapeamento CVE para `externalDomain` |

