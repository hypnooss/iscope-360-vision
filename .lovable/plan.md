
# Exibir descricao da regra e analise efetuada nos cards Exchange Online

## Problema

Na edge function `processM365AgentInsights`, o campo `description` do insight recebe o resultado dinamico da avaliacao (ex: "7 de 10 item(ns) nao conforme(s)"). O criterio da regra (`rule.description`, ex: "Verifica se...") nunca e salvo. Por isso os cards Exchange nao exibem a descricao da regra nem a secao "ANALISE EFETUADA" corretamente.

No Dominio Externo funciona porque o `ComplianceCheck` carrega o `description` da regra (criterio) diretamente do banco.

## Solucao em 3 pontos

### 1. Edge Function `agent-task-result/index.ts` (linha 335-347)

Adicionar `criteria` ao insight com o `rule.description`:

```text
insights.push({
  ...campos existentes...,
  criteria: rule.description,                    // NOVO: "Verifica se..."
  passDescription: rule.pass_description,        // NOVO
  failDescription: rule.fail_description,        // NOVO
  notFoundDescription: rule.not_found_description,// NOVO
  technicalRisk: rule.technical_risk,            // NOVO
  businessImpact: rule.business_impact,          // NOVO
  apiEndpoint: rule.api_endpoint,                // NOVO
});
```

### 2. Hook `useExchangeOnlineInsights.ts` (linhas 129-142)

Propagar os campos novos no mapeamento:

```text
return {
  ...campos existentes...,
  criteria: insight.criteria || '',
  passDescription: insight.passDescription || '',
  failDescription: insight.failDescription || '',
  notFoundDescription: insight.notFoundDescription || '',
  technicalRisk: insight.technicalRisk || '',
  businessImpact: insight.businessImpact || '',
  apiEndpoint: insight.apiEndpoint || '',
};
```

Expandir a interface `ExchangeInsight` com esses campos opcionais.

### 3. Mapper `mapExchangeAgentInsight` em `complianceMappers.ts`

Corrigir o mapeamento para o `UnifiedComplianceItem`:

- `description` -> `insight.criteria` (criterio da regra = "Verifica se..." = o que aparece no card)
- `failDescription` -> `insight.failDescription || insight.description` (mensagem de falha)
- `details` -> `insight.description` (resultado dinamico = secao "ANALISE EFETUADA")
- `technicalRisk`, `businessImpact`, `apiEndpoint` -> campos diretos

Resultado: identico ao Dominio Externo e Firewall.

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/agent-task-result/index.ts` | Adicionar 7 campos da regra ao insight (linha 335-347) |
| `src/hooks/useExchangeOnlineInsights.ts` | Expandir interface e mapeamento |
| `src/lib/complianceMappers.ts` | Corrigir mapeamento criteria/description/details |

## Nota

Analises ja executadas nao terao os campos novos. Sera necessario clicar em "Reanalisar" para popular os metadados.
