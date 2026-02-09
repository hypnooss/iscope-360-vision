
# Refatorar: Usar compliance_rules do banco para insights do Agent (remover hardcoded)

## Problema

A funcao `processM365AgentInsights()` em `agent-task-result/index.ts` (linhas 179-587) contem ~400 linhas de logica hardcoded que:
- Usa `source_key` como ID do insight (ex: `exo_mailbox_forwarding`) em vez do codigo da regra (`EXO-001`)
- Hardcoda nomes, descricoes, severidades e categorias que ja existem na tabela `compliance_rules`
- Viola a regra arquitetural de que toda logica deve vir do banco de dados

Alem disso, a Edge Function `exchange-online-insights` tambem duplica verificacoes (EXO-001 a EXO-006) ja cobertas pelas compliance_rules + Agent.

## Solucao

### 1. Refatorar `processM365AgentInsights()` para ser data-driven

Em vez de ter blocos `if (rawData['exo_mailbox_forwarding']) { ... }` hardcoded para cada source_key, a funcao deve:

1. Receber as `compliance_rules` carregadas do banco como parametro
2. Para cada regra ativa com `source_key` presente no `rawData`, avaliar usando a `evaluation_logic` da regra
3. Usar `code`, `name`, `category`, `severity` da regra do banco -- nao valores hardcoded

```text
Fluxo Atual (hardcoded):
  rawData[source_key] --> logica hardcoded --> insight com id=source_key

Fluxo Novo (data-driven):
  rawData[source_key] --> compliance_rules[source_key] --> evaluation_logic --> insight com id=rule.code
```

### 2. Carregar compliance_rules antes de processar

Na secao M365 do handler (~linha 4378), antes de chamar `processM365AgentInsights`, carregar as regras do banco:

```typescript
const { data: m365Rules } = await supabase
  .from('compliance_rules')
  .select('*')
  .eq('device_type_id', '5d1a7095-2d7b-4541-873d-4b03c3d6122f')
  .eq('is_active', true);
```

E passar para a funcao:
```typescript
const agentInsights = processM365AgentInsights(rawData, m365Rules || []);
```

### 3. Nova implementacao de `processM365AgentInsights`

A funcao iterara sobre as regras (nao sobre keys hardcoded):

```typescript
function processM365AgentInsights(
  rawData: Record<string, unknown>,
  rules: ComplianceRule[]
): M365AgentInsight[] {
  const insights: M365AgentInsight[] = [];
  
  for (const rule of rules) {
    const evalLogic = rule.evaluation_logic as any;
    const sourceKey = evalLogic?.source_key;
    if (!sourceKey || !rawData[sourceKey]) continue;
    
    const data = extractStepData(rawData[sourceKey]);
    if (!data) continue;
    
    // Avaliar usando evaluation_logic da regra
    const result = evaluateAgentRule(rule, data);
    if (!result) continue;
    
    insights.push({
      id: rule.code,           // EXO-001, nao exo_mailbox_forwarding
      category: rule.category, // do banco
      product: mapCategoryToProduct(rule.category),
      name: rule.name,         // do banco
      description: result.description,
      severity: result.status === 'pass' ? 'info' : rule.severity as any,
      status: result.status,
      details: result.details,
      recommendation: rule.recommendation || undefined,
      affectedEntities: result.affectedEntities,
      rawData: result.rawData,
    });
  }
  
  return insights;
}
```

### 4. Funcao `evaluateAgentRule` (nova)

Avalia os dados do Agent contra a `evaluation_logic` da regra. Os tipos de avaliacao ja definidos nas regras EXO incluem:

- `check_array_condition`: Verifica arrays (mailboxes com forwarding, transport rules, etc.)
- `check_policy_field`: Verifica campos de politicas (anti-phish, safe links, etc.)
- `check_boolean_field`: Verifica campos booleanos simples

Esta funcao lera `evaluation_logic.evaluate.type` e aplicara a logica correspondente, usando `pass_description`/`fail_description` da regra para gerar descricoes.

### 5. Remover chamada a `exchange-online-insights` do trigger

Em `trigger-m365-posture-analysis/index.ts` (linhas 206-232), remover o bloco que chama `exchange-online-insights` quando `scope === 'exchange_online'`, pois essa funcao duplica verificacoes ja cobertas pelo Agent + compliance_rules.

### 6. Verificar evaluation_logic das regras EXO no banco

Confirmar que todas as 16 regras EXO ativas possuem `evaluation_logic` compativel com dados do Agent (field_path, conditions, etc.). Se alguma regra nao tiver, adicionar.

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `agent-task-result/index.ts` | Substituir ~400 linhas hardcoded por funcao data-driven que le regras do banco |
| `trigger-m365-posture-analysis/index.ts` | Remover chamada a `exchange-online-insights` (linhas 206-232) |

## Resultado esperado

- Insights exibidos com codigos corretos (`EXO-001`, `EXO-007`, etc.) em vez de `exo_mailbox_forwarding`
- Nomes e descricoes vindos do banco, editaveis via Templates
- Sem duplicacao de insights entre API e Agent
- Conformidade com a regra arquitetural de zero hardcode
