
# Fix: Agent recebe 0 steps do Exchange Online

## Diagnostico Completo (fim-a-fim)

Foram identificados **dois problemas** na cadeia:

### Problema 1: Edge Functions nao foram redeployadas corretamente
Os logs mostram que `m365-security-posture` carregou **5 blueprints** mesmo com `blueprint_filter = 'exchange_online'`, confirmando que a versao anterior (sem o filtro) ainda estava rodando. Precisamos garantir o deploy.

### Problema 2 (CRITICO): `rpc_get_agent_tasks` nao encontra o blueprint Exchange
A funcao RPC filtra blueprints com `executor_type = 'agent'`, porem o blueprint "M365 - Exchange Online" tem `executor_type = 'hybrid'`. Resultado: **0 steps enviados ao Agent**.

```text
RPC Query:  WHERE db.executor_type = 'agent'
Blueprint:  executor_type = 'hybrid'  --> NAO ENCONTRADO --> 0 steps
```

## Solucao

### 1. Migrar SQL: Atualizar `rpc_get_agent_tasks`

Na secao M365 da funcao RPC (por volta da linha que faz `AND db.executor_type = 'agent'`), alterar para incluir `'hybrid'`:

```sql
AND db.executor_type IN ('agent', 'hybrid')
```

Isso permite que o blueprint Exchange (`hybrid`) seja encontrado. Os steps individuais ja sao filtrados pelo `COALESCE(step->>'executor', 'agent') = 'agent'`, garantindo que apenas os 18 steps PowerShell sejam enviados (o step `sample_users_for_mailbox` com `executor = 'edge_function'` continua sendo excluido).

### 2. Re-deploy Edge Functions

Redeployar ambas as edge functions para garantir que o codigo com `blueprint_filter` esteja ativo:
- `trigger-m365-posture-analysis`
- `m365-security-posture`

### 3. Nenhuma mudanca no frontend

O hook `useExchangeOnlineInsights` ja envia `scope: 'exchange_online'` corretamente (confirmado na linha 181).

## Resultado Esperado

Apos as alteracoes:
1. O Agent recebe 18 steps PowerShell (Exchange Online) em vez de 0
2. A API executa apenas 1 step Graph API (Exchange) em vez de 39
3. Sem erros 403 em endpoints irrelevantes
4. A tarefa do Agent conclui com dados reais em vez de "0 steps completed"
