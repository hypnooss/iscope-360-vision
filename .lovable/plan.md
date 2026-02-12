

# Fix: Agent nao consegue executar nem reportar tasks do Attack Surface

## Problemas identificados

### Problema 1: "Executor desconhecido 'masscan'" (Python Agent)
O agent v1.2.7 no servidor **nao reconhece** os executors `masscan`, `nmap` e `httpx`. Embora o codigo-fonte no repositorio ja tenha esses executors registrados (tasks.py linhas 53-55), o agent **rodando no servidor** precisa ser atualizado para a versao mais recente.

**Acao necessaria (manual):** Atualizar o Python Agent no servidor para a versao mais recente que contem os executors de masscan/nmap/httpx. Isso pode ser feito via o mecanismo de auto-update ou reinstalacao manual.

### Problema 2: "POST /agent-step-result -> NOT_FOUND" (Edge Functions)
Mesmo que o executor funcione, os resultados nunca seriam salvos. O agent Python envia resultados para:
- `/agent-step-result` (step individual)
- `/agent-task-result` (resultado final)

Porem, essas edge functions buscam a tarefa na tabela `agent_tasks` (linha 177 do agent-step-result). As tarefas de Attack Surface ficam na tabela `attack_surface_tasks`, entao a busca retorna NOT_FOUND.

## Solucao para o Problema 2

Modificar as edge functions `agent-step-result` e `agent-task-result` para detectar tarefas de attack surface e roteá-las corretamente.

### Arquivo: `supabase/functions/agent-step-result/index.ts`

Apos a busca falhar em `agent_tasks`, tentar buscar em `attack_surface_tasks`. Se encontrado, redirecionar o resultado para a logica do `attack-surface-step-result` (atualizar diretamente a task e verificar se o snapshot esta completo).

Alteracao principal (apos linha 188):

```text
// Se nao encontrou em agent_tasks, tentar em attack_surface_tasks
if (taskError || !task) {
  const { data: asTask, error: asError } = await supabase
    .from('attack_surface_tasks')
    .select('id, assigned_agent_id, status, snapshot_id, ip')
    .eq('id', body.task_id)
    .single()

  if (!asError && asTask) {
    // Delegar para logica de attack surface
    return handleAttackSurfaceStepResult(supabase, body, asTask, corsHeaders)
  }

  // Nenhuma das tabelas tem a task
  return NOT_FOUND response
}
```

### Arquivo: `supabase/functions/agent-task-result/index.ts`

Mesma abordagem: apos falhar em `agent_tasks`, verificar `attack_surface_tasks`. Se encontrado, atualizar o status da task e consolidar o snapshot quando todas as tasks completarem.

### Detalhes tecnicos

A funcao `handleAttackSurfaceStepResult` ira:
1. Acumular os resultados dos 3 steps (masscan, nmap, httpx) no campo `result` da `attack_surface_tasks`
2. No ultimo step (ou no task-result final), marcar a task como completed
3. Verificar se todas as tasks do snapshot estao completas
4. Se sim, consolidar o snapshot (mesma logica que ja existe em `attack-surface-step-result`)

A funcao `handleAttackSurfaceTaskResult` ira:
1. Atualizar status da task em `attack_surface_tasks`
2. Salvar o resultado consolidado
3. Verificar e consolidar o snapshot se necessario

### Arquivos alterados
- `supabase/functions/agent-step-result/index.ts` - Fallback para attack_surface_tasks
- `supabase/functions/agent-task-result/index.ts` - Fallback para attack_surface_tasks
- Deploy de ambas as edge functions

### Sobre o Problema 1 (Python Agent)
Apos verificar, os executors `masscan`, `nmap` e `httpx` **ja existem** no codigo-fonte do agent (tasks.py linhas 53-55). O agent no servidor precisa ser atualizado. Opcoes:
- Usar o sistema de auto-update (se configurado)
- Reinstalar manualmente: `cd /opt/iscope-agent && git pull && systemctl restart iscope-agent`
- Verificar se a versao correta esta no storage bucket `agent-releases`

