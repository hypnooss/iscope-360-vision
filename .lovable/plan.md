

## Tornar avaliação de compliance genérica — eliminar handlers hardcoded

### Problema
As 5 regras da Fase 1 têm `evaluation_logic` bem estruturada no banco (com `type`, `source_key`, `condition`, `field`, `path` etc.), mas `normalizeEvaluationLogic` não reconhece esses formatos. O workaround foi adicionar blocos `if (rule.code === 'cert-001')` hardcoded — exatamente o que deve ser eliminado.

### Alterações

**Arquivo**: `supabase/functions/agent-task-result/index.ts`

1. **Expandir `normalizeEvaluationLogic`** para reconhecer os 3 novos tipos de `evaluation_logic` do banco:
   - Quando `rawLogic.type === 'array_check'` ou `'object_check'` ou `'threshold_check'`, extrair `source_key` do campo `rawLogic.source_key` e retornar um `NormalizedEvaluationLogic` com o `source_key` correto (para que `rawData[source_key]` funcione)
   - O `field_path` pode ser `rawLogic.path || rawLogic.field || ''`

2. **Criar função `evaluateTypedLogic`** que interpreta genericamente os 3 tipos:
   - `array_check`: Lê `rawLogic.path` do sourceData, itera o array, aplica `condition` (`none_match` / `all_match`) com `field` + `value` (ou `alt_condition` + `alt_field` + `alt_value`). Array vazio → `not_found`
   - `object_check`: Lê `rawLogic.path` do sourceData, verifica `condition: "field_exists"` com `field` + `expected_value`
   - `threshold_check`: Lê `rawLogic.path` do sourceData, itera `checks[]` aplicando `operator` (`lt`, `gt`, `eq`) com `field` e `value`

3. **Integrar no loop principal** (`processComplianceRules`): Após obter `sourceData`, antes dos handlers de prefixo, verificar se `rule.evaluation_logic.type` é um dos 3 tipos. Se sim, chamar `evaluateTypedLogic` e gerar o `ComplianceCheck` diretamente — sem cair nos blocos de prefixo.

4. **Remover os 5 blocos hardcoded** (`rule.code === 'cert-001'`, `'vpn-004'`, `'fg-001'`, `'perf-001'`, `'sec-004'`).

5. **Deploy** da edge function `agent-task-result`.

### Resultado
Qualquer regra futura que use `type: "array_check"`, `"object_check"` ou `"threshold_check"` no banco será avaliada automaticamente, sem necessidade de código novo.

