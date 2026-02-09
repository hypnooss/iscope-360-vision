

# Correcao do TypeError no processamento de step results no agent-task-result

## Problema

Quando um step do PowerShell retorna output nao-JSON (ex: uma mensagem WARNING do Exchange), o agente Python envia o resultado com `raw: true` e o campo `data` como string. Na edge function `agent-task-result`, ao reconstruir os dados dos steps (linha 4080), o codigo faz:

```text
if (step.step_id in stepData ...)
```

O operador `in` do JavaScript so funciona em objetos. Quando `stepData` e uma string, o `in` lanca `TypeError: Cannot use 'in' operator to search for 'exo_outbound_connectors' in WARNING: ...`.

Isso faz toda a tarefa falhar com `INTERNAL_ERROR`, mesmo que os outros 17 steps tenham sido processados com sucesso.

## Causa Raiz

O step `exo_outbound_connectors` retornou a string de warning do PowerShell ("WARNING: There is at least one test mode connector...") em vez de JSON. O agente tratou corretamente como `raw: true`, mas a edge function nao valida se `stepData` e um objeto antes de usar o operador `in`.

## Solucao

No arquivo `supabase/functions/agent-task-result/index.ts`, adicionar uma validacao de tipo antes do operador `in` na linha 4080:

```text
Antes (linha 4074-4086):
  if (step.status === 'success' && step.data) {
    const stepData = step.data as Record<string, unknown>;
    if (step.step_id in stepData && typeof stepData[step.step_id] === 'object') {
      rawData[step.step_id] = stepData[step.step_id];
    } else {
      rawData[step.step_id] = stepData;
    }
  }

Depois:
  if (step.status === 'success' && step.data) {
    const stepData = step.data as Record<string, unknown>;
    if (stepData && typeof stepData === 'object' && !Array.isArray(stepData) && step.step_id in stepData && typeof stepData[step.step_id] === 'object') {
      rawData[step.step_id] = stepData[step.step_id];
    } else {
      rawData[step.step_id] = stepData;
    }
  }
```

A validacao `typeof stepData === 'object' && !Array.isArray(stepData)` garante que o operador `in` so e usado em objetos planos, ignorando strings e arrays.

## Detalhes Tecnicos

- Arquivo: `supabase/functions/agent-task-result/index.ts`
- Linha afetada: 4080
- Alteracao: adicionar guard `typeof stepData === 'object' && !Array.isArray(stepData)` antes do `in`
- A edge function precisara ser re-deployada apos a alteracao

