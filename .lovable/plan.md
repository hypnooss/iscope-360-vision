
# Fix: Step results do Attack Surface sendo sobrescritos

## Problema raiz

Na Edge Function `agent-step-result`, ao buscar uma task de attack surface para acumular os resultados dos steps, o SELECT nao inclui o campo `result`:

```text
.select('id, assigned_agent_id, status, snapshot_id, ip')
                                                       ^ falta 'result'
```

Na linha seguinte, `(asTask as any).result` retorna `undefined`, e `currentResult` vira `{}`. Cada step result sobrescreve o anterior em vez de acumular. Apenas o ultimo step executado (httpx_webstack) sobrevive no banco.

## Impacto

- masscan_discovery: resultado perdido (sobrescrito pelo nmap)
- nmap_fingerprint: resultado perdido (sobrescrito pelo httpx)
- httpx_webstack: unico que sobrevive (ultimo a ser reportado)
- A UI mostra 0 portas e 0 servicos mesmo quando masscan/nmap executaram

## Correcao

### Arquivo: `supabase/functions/agent-step-result/index.ts`

Adicionar `result` ao SELECT na linha 186:

```text
Antes:  .select('id, assigned_agent_id, status, snapshot_id, ip')
Depois: .select('id, assigned_agent_id, status, snapshot_id, ip, result')
```

Isso permite que o `currentResult` contenha os resultados dos steps anteriores, e o spread `...currentResult` funcione corretamente para acumular todos os steps.

## Problema secundario: masscan e permissoes

O masscan precisa de raw sockets (root/CAP_NET_RAW) para funcionar. Se o agent roda como usuario `iscope-agent`, o masscan pode falhar silenciosamente (retornando 0 portas sem erro). O executor atual nao verifica o `returncode` nem o `stderr` do subprocess. Isso sera abordado em um proximo passo apos confirmar que a acumulacao funciona.

## Resultado esperado

Apos o deploy:
- Os 3 steps (masscan, nmap, httpx) aparecerao em `raw_steps`
- Se masscan falhar, o erro ficara visivel em `raw_steps.masscan_discovery.error`
- A UI mostrara os dados de todos os steps que executaram com sucesso
