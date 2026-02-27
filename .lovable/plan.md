

## Plano: Mover Shadow Rules para Compliance + Corrigir cores de categorias

### 1. Adicionar check de Shadow Rules em `fortigate-compliance/index.ts`

Na função `checkFirewallRules`, após o check `net-003` (Any-Any), adicionar novo check `net-004`:
- Filtrar políticas ativas (`status === 'enable'`) que **não** sejam `deny` (`action !== 'deny'`)
- Dessas, identificar as com `bytes === 0` ou `hit_count === 0`
- Categoria: `"Configuração de Rede"`
- Severidade: `high` se >= 10 regras, `medium` se >= 3, `low` caso contrário
- Evidências: listar cada regra não utilizada com policyid, nome, srcintf→dstintf, action
- Recomendação: revisar e remover regras sem tráfego para reduzir superfície de ataque

Dados já disponíveis — o endpoint `/cmdb/firewall/policy` retorna `action`, `bytes`, `hit_count`, `status` em cada policy.

### 2. Remover Shadow Rules do Analyzer

**`supabase/functions/firewall-analyzer/index.ts`**:
- Remover função `analyzeShadowRules` e sua chamada
- Remover métricas `totalPolicies`, `unusedPolicies`, `shadowRules` do objeto de resultado

**`src/pages/firewall/AnalyzerDashboardPage.tsx`**:
- Remover o card "Regras Não Utilizadas (Shadow Rules)" (linhas ~1061-1090)
- Remover referências a `totalPolicies`/`unusedPolicies` no stat card de políticas (~740-744)

**`src/types/analyzerInsights.ts`**:
- Remover campos `totalPolicies`, `unusedPolicies`, `shadowRules` e interface `ShadowRule` do `AnalyzerMetrics`

### 3. Adicionar cores às categorias sem configuração

Em `src/hooks/useCategoryConfig.ts`, adicionar ao `DEFAULT_CATEGORY_CONFIGS`:
- `'Alta Disponibilidade'`: `{ icon: 'server', color: 'blue-500' }`
- `'Backup e Recovery'`: `{ icon: 'hard-drive', color: 'amber-500' }`
- `'Atualizações'`: `{ icon: 'activity', color: 'green-500' }`
- `'Recomendações'`: `{ icon: 'check-circle', color: 'teal-500' }`

### Arquivos editados (5)
- `supabase/functions/fortigate-compliance/index.ts` — adicionar check net-004
- `supabase/functions/firewall-analyzer/index.ts` — remover analyzeShadowRules
- `src/pages/firewall/AnalyzerDashboardPage.tsx` — remover card e stat de shadow rules
- `src/types/analyzerInsights.ts` — remover tipos ShadowRule
- `src/hooks/useCategoryConfig.ts` — adicionar cores faltantes

