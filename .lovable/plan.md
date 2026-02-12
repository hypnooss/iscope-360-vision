

# Fix: Queue do Attack Surface nao extrai IPs de Firewall

## Problema

A funcao `run-attack-surface-queue` tenta ler IPs de firewall a partir de `agent_tasks.step_results` (linha 194), mas esse campo esta sempre vazio (`NULL`). Os resultados dos steps sao armazenados na tabela separada `task_step_results`, nao embutidos no `agent_tasks`.

Resultado: apenas IPs de origem DNS sao coletados. IPs de firewall sao ignorados porque a query retorna `step_results = null`.

## Evidencia

Query confirmou que **todos** os `agent_tasks` de firewall completados tem `step_results = NULL`, enquanto a tabela `task_step_results` tem 23 registros por task.

## Correcao

### Arquivo: `supabase/functions/run-attack-surface-queue/index.ts`

Alterar a secao de extracao de IPs de firewall (linhas 191-210) para ler da tabela `task_step_results` em vez de `agent_tasks.step_results`:

```text
Antes (errado):
  .from('agent_tasks')
  .select('step_results')        // campo sempre NULL
  ...
  extractFirewallIPs(tasks[0].step_results, fw.name)

Depois (correto):
  .from('agent_tasks')
  .select('id')                  // so precisa do ID
  ...
  // Buscar steps da tabela correta
  .from('task_step_results')
  .select('step_id, data')
  .eq('task_id', tasks[0].id)
  .eq('step_id', 'system_interface')
  ...
  extractFirewallIPs(stepResults, fw.name)
```

Isso replica a mesma logica que a funcao `attack-surface-scan` ja usa corretamente (linhas 737-741 daquele arquivo).

### Resultado esperado

- IPs publicos de interfaces de firewall serao coletados corretamente
- Tasks serao criadas para todos os IPs (DNS + Firewall)
- O proximo scan mostrara 6 IPs em vez de apenas 2

