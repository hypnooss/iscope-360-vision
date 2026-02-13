

# Fix: Badges de Conformidade do Firewall nao aparecem no Dashboard

## Problema

O card Firewall mostra "Nenhum alerta" mesmo tendo **2 High** e **3 Medium** fora de conformidade. Isso acontece porque a funcao RPC `get_fw_dashboard_summary` busca severidades no caminho `report_data->'summary'->>'critical'`, mas esse campo **nao existe** no JSON do firewall.

A estrutura real do `report_data` e:
```text
report_data
  -> categories (objeto com chaves por nome de categoria)
       -> [array de checks]
            -> status: "fail" | "pass" | "unknown"
            -> severity: "critical" | "high" | "medium" | "low"
```

Os modulos M365 e Dominio Externo nao tem este problema porque usam colunas dedicadas (`summary`) em vez de extrair do JSON.

## Solucao

Reescrever a funcao RPC `get_fw_dashboard_summary` para contar severidades a partir da estrutura real do `report_data`, filtrando apenas checks com `status = 'fail'`.

## Detalhes Tecnicos

### Alteracao na RPC (SQL)

A funcao atual:
```sql
SELECT DISTINCT ON (ah.firewall_id)
  ah.firewall_id, ah.score,
  COALESCE((ah.report_data->'summary'->>'critical')::integer, 0),  -- sempre 0
  ...
```

Nova versao -- usa lateral join para iterar categorias e checks:
```sql
CREATE OR REPLACE FUNCTION get_fw_dashboard_summary(p_firewall_ids uuid[])
RETURNS TABLE(
  firewall_id uuid, score integer,
  critical integer, high integer, medium integer, low integer,
  analyzed_at timestamptz
) AS $$
  SELECT
    sub.firewall_id,
    sub.score,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='critical' THEN 1 ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='high' THEN 1 ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='medium' THEN 1 ELSE 0 END), 0)::integer,
    COALESCE(SUM(CASE WHEN c.chk->>'status'='fail' AND c.chk->>'severity'='low' THEN 1 ELSE 0 END), 0)::integer,
    sub.created_at
  FROM (
    SELECT DISTINCT ON (ah.firewall_id)
      ah.firewall_id, ah.score, ah.report_data, ah.created_at
    FROM analysis_history ah
    WHERE ah.firewall_id = ANY(p_firewall_ids)
    ORDER BY ah.firewall_id, ah.created_at DESC
  ) sub
  LEFT JOIN LATERAL (
    SELECT jsonb_array_elements(cat_value) AS chk
    FROM jsonb_each(sub.report_data->'categories') AS cats(cat_key, cat_value)
  ) c ON true
  GROUP BY sub.firewall_id, sub.score, sub.created_at;
$$ LANGUAGE sql STABLE;
```

### Arquivo alterado no codigo

Nenhuma alteracao no frontend -- o hook `useDashboardStats.ts` ja le corretamente os campos `critical`, `high`, `medium`, `low` retornados pela RPC. O problema e exclusivamente na funcao SQL.

| Onde | Alteracao |
|---|---|
| Migration SQL (nova) | Reescrever `get_fw_dashboard_summary` para contar checks com `status='fail'` por severidade |

## Resultado esperado

- Card Firewall exibira badges coloridas: **2 Alto**, **3 Medio** (valores reais da ultima analise)
- Comportamento dos cards M365 e Dominio Externo permanece inalterado

