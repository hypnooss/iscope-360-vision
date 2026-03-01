

## Corrigir campos ausentes nos itens de M365 Compliance

### Problema
Alguns itens no M365 Compliance (especialmente os vindos do Agent/PowerShell) não exibem "Impacto no Negócio", "Risco Técnico" e "Análise Efetuada" na sheet lateral. Isso ocorre porque:

1. **Tipo `M365AgentInsight`** não inclui os campos `technicalRisk`, `businessImpact`, `apiEndpoint`, `criteria` que o backend já envia
2. **`mapM365AgentInsight`** não mapeia esses campos para `UnifiedComplianceItem`
3. **`mapM365AgentInsight`** não constrói `evidence` a partir de `affectedEntities`
4. **Edge function `createNotFoundInsight`** envia `riscoTecnico: ''` e `impactoNegocio: ''` em vez de usar os valores da regra

### Alterações

**1. `src/types/m365Insights.ts` — Expandir `M365AgentInsight`**
Adicionar campos opcionais: `criteria`, `passDescription`, `failDescription`, `notFoundDescription`, `technicalRisk`, `businessImpact`, `apiEndpoint`. Esses campos já são enviados pelo backend (`agent-task-result`).

**2. `src/lib/complianceMappers.ts` — Enriquecer `mapM365AgentInsight`**
- Mapear `technicalRisk`, `businessImpact`, `apiEndpoint` para os campos correspondentes do `UnifiedComplianceItem`
- Usar `criteria` como `description` (texto estático da regra)
- Usar `description` existente como `details` (análise dinâmica)
- Construir `evidence` a partir de `affectedEntities` (mesmo padrão dos outros mappers)
- Construir `rawData` com dados relevantes (endpoint, status, rawData original)

**3. `supabase/functions/m365-security-posture/index.ts` — Corrigir `createNotFoundInsight`**
Alterar linhas 826-827 para usar `rule.technical_risk` e `rule.business_impact` em vez de strings vazias, garantindo que mesmo itens "Não Encontrado" tenham contexto técnico.

### Arquivos a editar
1. `src/types/m365Insights.ts` — adicionar 7 campos opcionais ao `M365AgentInsight`
2. `src/lib/complianceMappers.ts` — enriquecer `mapM365AgentInsight` com todos os campos
3. `supabase/functions/m365-security-posture/index.ts` — corrigir `createNotFoundInsight` (linhas 826-827)

