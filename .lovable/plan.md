

## Plano: Corrigir evidências NaN em Performance de CPU e Memória

### Problema

A regra `perf-001` usa `threshold_check` com `path: "results"` e campos `cpu` e `mem`. Porém, `results.cpu` e `results.mem` são **objetos** (ex: `{ idle: 95, user: 1, ... }`), não números. `Number({...})` retorna `NaN`.

### Solução

Duas abordagens possíveis:

**Opção A (código)**: Atualizar `evaluateThresholdCheck` em `agent-task-result/index.ts` para, quando o valor de um campo for um objeto com propriedade `idle`, calcular automaticamente o uso como `100 - idle`. Isso trata o padrão de dados do FortiOS genericamente.

**Opção B (DB)**: Atualizar a `evaluation_logic` da regra no banco para usar campos com dot-notation (`cpu.idle`, `mem.used`) e ajustar operadores. Porém, a estrutura de `mem` pode não ter `idle`, e exigiria lógica invertida.

Recomendo **Opção A** por ser mais robusta e compatível com o formato de dados do FortiOS.

### Mudança em `supabase/functions/agent-task-result/index.ts`

Na função `evaluateThresholdCheck` (~linha 794), após resolver `actualValue`:
- Se `actualValue` é um objeto com campo `idle` (número), calcular `numVal = 100 - idle` (uso percentual)
- Usar o `label` do check (se disponível) na evidência em vez do `field` bruto
- Formatar evidência como `"XX%"` em vez de número cru

### Arquivo editado (1)
- `supabase/functions/agent-task-result/index.ts`

### Requer deploy
- Edge function `agent-task-result`
- Re-executar análise de Compliance no firewall para gerar novos dados

