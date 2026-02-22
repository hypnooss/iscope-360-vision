
# Desacoplar Consolidacao do Attack Surface

## Problema

Quando a ultima task de um snapshot termina, as edge functions `attack-surface-step-result` e `agent-task-result` fazem a consolidacao inline (buscar todas as tasks, calcular score, match de CVEs). Isso leva tempo e causa timeout no agent.

## Solucao: Fire-and-Forget

As edge functions que recebem resultados do agent vao:
1. Salvar os dados da task no banco
2. Verificar se todas as tasks do snapshot terminaram
3. Se sim, disparar `fetch()` para uma nova edge function `consolidate-attack-surface` **sem await** (fire-and-forget)
4. Retornar `{ success: true }` imediatamente ao agent

A consolidacao roda em paralelo, sem bloquear a resposta.

## Mudancas

### 1. Nova edge function: `supabase/functions/consolidate-attack-surface/index.ts`

Recebe `{ snapshot_id }` e executa toda a logica pesada:
- Busca todas as tasks completadas do snapshot
- Monta o mapa de resultados por IP
- Calcula score de exposicao
- Faz match de CVEs via cve_cache
- Atualiza o snapshot com results, summary, score, cve_matches, status=completed

Essa funcao sera chamada internamente (fire-and-forget), entao usa service_role_key para autenticacao.

### 2. Modificar: `supabase/functions/attack-surface-step-result/index.ts`

- Remover toda a logica de consolidacao (linhas 67-193)
- Apos salvar a task e verificar pendingCount === 0, disparar fire-and-forget:
```
fetch(`${supabaseUrl}/functions/v1/consolidate-attack-surface`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
  body: JSON.stringify({ snapshot_id: snapshotId })
})
// sem await — fire and forget
```
- Retornar `{ success: true }` imediatamente

### 3. Modificar: `supabase/functions/agent-task-result/index.ts`

Na funcao `handleAttackSurfaceTaskResult` (linhas 3984-4077):
- Remover toda a logica de consolidacao inline (fetch tasks, calcular score, CVE matching)
- Substituir por fire-and-forget para `consolidate-attack-surface`
- Retornar resposta imediatamente ao agent

### 4. Atualizar: `supabase/config.toml`

Adicionar configuracao para a nova edge function:
```toml
[functions.consolidate-attack-surface]
verify_jwt = false
```

## Detalhes tecnicos

### Fire-and-forget em Deno

```typescript
// Dispara sem bloquear — a consolidacao roda em background
fetch(`${supabaseUrl}/functions/v1/consolidate-attack-surface`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`
  },
  body: JSON.stringify({ snapshot_id: snapshotId })
}).catch(err => console.error('[consolidate] fire-and-forget failed:', err.message))
```

O `fetch()` sem `await` inicia a request e continua. O `.catch()` evita unhandled promise rejection.

### Idempotencia

A `consolidate-attack-surface` deve ser idempotente — se chamada 2x para o mesmo snapshot (race condition entre step-result e task-result), a segunda execucao simplesmente recalcula e sobrescreve. Sem efeitos colaterais.

### Protecao contra chamada duplicada

Antes de consolidar, a funcao verifica se o snapshot ainda esta em status `running` (nao `completed`). Se ja estiver completed, retorna sem fazer nada.

## O que NAO muda

- Nenhum codigo do python-agent
- Nenhum componente de UI
- A logica de consolidacao em si (score, CVE matching) permanece identica, so muda de lugar
- O `agent-step-result` (steps progressivos) continua salvando steps normalmente

## Fluxo resultante

```text
Agent envia resultado
  -> attack-surface-step-result recebe
  -> Salva task no banco
  -> Retorna OK (< 1 segundo)
  -> Fire-and-forget -> consolidate-attack-surface
      -> Busca tasks, calcula score, CVE match
      -> Atualiza snapshot (10-60 segundos)
```
