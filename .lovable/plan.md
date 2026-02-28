

## Plano: Corrigir coleta de dados do net-004 (Shadow Rules)

### Causa Raiz

1. A regra `net-004` no banco tem `evaluation_logic.type = 'filtered_count_check'` mas **não tem `source_key`**
2. A função `normalizeEvaluationLogic` (linha 561) lista `array_check`, `object_check`, `threshold_check` para extrair `source_key`, mas **não inclui `filtered_count_check`**
3. Resultado: `source_key` resolve para `''`, o `rawData['']` retorna `undefined`, e o check é marcado como `unknown` com "Dados não disponíveis:"

### Correções (2 mudanças)

#### 1. Banco de dados: Adicionar `source_key` ao `evaluation_logic` da regra `net-004`
- SQL: `UPDATE compliance_rules SET evaluation_logic = evaluation_logic || '{"source_key": "firewall_policy"}'::jsonb WHERE code = 'net-004'`
- Isso mapeia a regra ao step `firewall_policy` que já é coletado pelo blueprint

#### 2. Edge Function `agent-task-result/index.ts` (linha ~561)
- Adicionar `'filtered_count_check'` à lista de tipos que extraem `source_key` em `normalizeEvaluationLogic`
- De: `if (logicType === 'array_check' || logicType === 'object_check' || logicType === 'threshold_check')`
- Para: `if (logicType === 'array_check' || logicType === 'object_check' || logicType === 'threshold_check' || logicType === 'filtered_count_check')`

### Resultado
Na próxima execução de compliance, a regra encontrará os dados de `firewall_policy` coletados pelo agent, aplicará os `pre_filters` e `match_conditions`, e retornará pass/fail com evidências detalhadas das shadow rules.

### Arquivos editados
- Migration SQL (1 UPDATE)
- `supabase/functions/agent-task-result/index.ts` (1 linha)

