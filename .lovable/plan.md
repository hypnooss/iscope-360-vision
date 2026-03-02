

## Otimizacao de Payloads Supabase - Reducao de `affectedEntities`

### Problema

Multiplos hooks fazem queries com `.select('*')` ou `.select('insights, ...')` na tabela `m365_posture_history`, carregando o campo `insights` completo que contem arrays de `affectedEntities` com centenas de objetos por insight. Isso gera payloads de varios MB por request.

**Queries problematicas identificadas:**

| Hook | Query | Problema |
|------|-------|----------|
| `useM365SecurityPosture.ts:57` | `.select('*')` | Carrega TUDO incluindo insights completos |
| `useM365AnalyzerData.ts:192` | `.select('*')` com `limit(24)` | 24 snapshots completos |
| `useEntraIdInsights.ts:89` | `.select('insights, agent_insights, ...')` com `limit(5)` | 5 registros com insights completos |
| `useEntraIdSecurityInsights.ts:56` | `.select('insights, ...')` | Insights completos |
| `useEntraIdApplicationInsights.ts:56` | `.select('insights, ...')` | Insights completos |

### Solucao

**Estrategia em 2 camadas:**

1. **Criar uma database function** (`get_posture_insights_lite`) que retorna os insights com `affectedEntities` truncado (apenas `affectedCount` + primeiros 3 nomes). Isso evita mudar a estrutura de dados armazenada, apenas otimiza a leitura.

2. **Ajustar os selects nos hooks** para pedir apenas as colunas necessarias, substituindo `select('*')` por colunas explicitas sem o campo `insights` quando nao for necessario (ex: dashboard, executions list).

3. **Carregar affectedEntities sob demanda** — quando o usuario clica em "Ver Entidades Afetadas", fazer uma query pontual buscando apenas o insight especifico.

### Arquivos a modificar

- `src/hooks/useM365SecurityPosture.ts` — substituir `select('*')` por colunas explicitas; usar RPC para insights lite
- `src/hooks/useM365AnalyzerData.ts` — substituir `select('*')` por colunas sem `insights`
- `src/hooks/useEntraIdInsights.ts` — usar RPC lite em vez de carregar insights crus
- `src/hooks/useEntraIdSecurityInsights.ts` — idem
- `src/hooks/useEntraIdApplicationInsights.ts` — idem

### Migracao SQL

Criar function `get_posture_insights_lite(p_tenant_record_id uuid)` que:
- Busca o ultimo registro completed de `m365_posture_history`
- Retorna insights com `affectedEntities` limitado a count + 3 primeiros nomes
- Retorna `agent_insights` com tratamento similar

Criar function `get_insight_affected_entities(p_history_id uuid, p_insight_id text)` que:
- Busca um insight especifico e retorna as `affectedEntities` completas (para drill-down)

### Impacto esperado

Reducao de payload estimada em 70-90% nas queries de postura, dependendo do numero de entidades afetadas por tenant.

