

## Problema

O fluxo atual do M365 Compliance é:

1. `trigger-m365-posture-analysis` dispara Graph API + cria agent task em paralelo
2. Graph API termina em ~30s → status muda para `completed`
3. Frontend detecta `completed` e exibe os resultados (incompletos — sem dados do Agent)
4. Agent termina minutos depois → `agent-task-result` faz merge silencioso dos insights do PowerShell

O Domain Compliance funciona diferente: só gera o relatório quando o agent completa (`agent-task-result`), garantindo que todos os dados estejam presentes.

## Solução

Quando o tenant tem agent vinculado, o Graph API não deve marcar como `completed` — deve usar `partial`. O `agent-task-result` é quem marca `completed` após fazer o merge.

### Alterações

**1. `supabase/functions/trigger-m365-posture-analysis/index.ts`**

Na função `runAnalysis()` (linha ~263-277), ao salvar os resultados do Graph API:
- Se `agentTaskId` existe → salvar com `status: 'partial'` (em vez de `completed`)
- Se não tem agent → manter `status: 'completed'`

Passar `agentTaskId` para dentro do closure `runAnalysis` (já está acessível via escopo).

**2. `supabase/functions/agent-task-result/index.ts`**

No bloco M365 Tenant (linha ~4870-4879), ao atualizar `m365_posture_history`:
- Adicionar `status: 'completed'` no update (além de `agent_status`, `summary`, `score`)
- Assim o frontend só vê `completed` quando TODOS os dados estão disponíveis

**3. `src/hooks/useM365SecurityPosture.ts`**

No polling (linha ~134-148):
- Alterar condição de parada: além de `completed` e `failed`, também parar em `partial` **apenas se não houver agent** (mas isso já é tratado pelo backend agora)
- Na prática, basta manter o polling como está — ele já espera por `completed`

### Fluxo resultante

```text
COM Agent:
  trigger → Graph API termina → status='partial' → Agent termina → agent-task-result marca 'completed' → frontend exibe

SEM Agent:
  trigger → Graph API termina → status='completed' → frontend exibe
```

