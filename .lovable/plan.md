

## Plano: Implementar Shadow Rules no novo sistema de Compliance

### Contexto

A verificação de Shadow Rules (`net-004`) existe na edge function **legada** `fortigate-compliance`, mas o sistema migrou para o modelo de regras em BD (`compliance_rules`) + avaliação em `agent-task-result`. A lógica de Shadow Rules precisa de um novo tipo de avaliação porque requer filtros compostos (status=enable, action≠deny, bytes=0 ou hit_count=0) que não são suportados pelos tipos atuais (`array_check`, `object_check`, `threshold_check`).

### Mudanças

#### 1. Novo tipo de avaliação `filtered_count_check` em `agent-task-result/index.ts`

Adicionar suporte a um novo tipo genérico que:
- Recebe um array de objetos (via `path`)
- Aplica `pre_filters` sequenciais (include/exclude por campo e valor)
- Aplica `match_condition` final (ex: campo = 0)
- Pass se nenhum item restante atender a condição, fail caso contrário
- Gera evidências com os itens que falharam

Lógica resumida:
```text
1. Resolve array from path (+ .results fallback)
2. Apply pre_filters: [{field, op, value}] — filter IN (keep matching) or OUT (remove matching)
3. Apply match_conditions: [{field, op, value}] — items matching ALL = "violating"
4. status = violating.length === 0 ? 'pass' : 'fail'
5. Evidence = list of violating items with label fields
```

Registrar o tipo no `evaluateTypedLogic` switch.

#### 2. Criar regra `net-004` no banco de dados (`compliance_rules`)

Inserir via SQL a regra com `evaluation_logic`:
```json
{
  "type": "filtered_count_check",
  "path": "results",
  "pre_filters": [
    {"field": "status", "op": "equals", "value": "enable"},
    {"field": "action", "op": "not_in", "value": ["deny", "block"]}
  ],
  "match_conditions": [
    {"field": "bytes", "op": "lte", "value": 0},
    {"field": "hit_count", "op": "lte", "value": 0, "join": "or"}
  ],
  "evidence_label": "Regra #{policyid}: {name}",
  "evidence_value": "{srcintf} → {dstintf} · action: {action}"
}
```

Associada ao `device_type_id` do FortiGate, categoria "Configuração de Rede", código `net-004`.

### Arquivos editados (1)
- `supabase/functions/agent-task-result/index.ts` — adicionar `filtered_count_check`

### Ação manual necessária (1)
- Inserir regra `net-004` na tabela `compliance_rules` via Admin > Templates ou SQL

### Requer deploy
- Edge function `agent-task-result`
- Re-executar análise de Compliance

