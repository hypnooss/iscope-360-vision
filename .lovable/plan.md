

## ✅ Tornar avaliação de compliance genérica — eliminar handlers hardcoded

**Status: Concluído**

### O que foi feito

1. **Expandido `normalizeEvaluationLogic`** para reconhecer `type: "array_check"`, `"object_check"`, `"threshold_check"` e extrair `source_key` corretamente.

2. **Criada função `evaluateTypedLogic`** com 3 sub-funções genéricas:
   - `evaluateArrayCheck`: Itera array, aplica `condition` (`none_match`/`all_match`) com `field` + `value`. Array vazio → `not_found`.
   - `evaluateObjectCheck`: Verifica `condition: "field_exists"` com `field` + `expected_value`.
   - `evaluateThresholdCheck`: Itera `checks[]` aplicando `operator` (`lt`/`gt`/`eq`/`lte`/`gte`) com `field` e `value`. Suporta campos alternativos com `|`.

3. **Integrado no loop principal**: Após obter `sourceData`, antes dos handlers de prefixo, verifica se `rule.evaluation_logic.type` é um dos 3 tipos. Se sim, chama `evaluateTypedLogic` e gera o `ComplianceCheck` diretamente.

4. **Removidos os 5 blocos hardcoded** (`cert-001`, `vpn-004`, `fg-001`, `perf-001`, `sec-004`).

5. **Deploy** da edge function `agent-task-result` concluído.

### Resultado
Qualquer regra futura que use `type: "array_check"`, `"object_check"` ou `"threshold_check"` no banco será avaliada automaticamente, sem necessidade de código novo.
