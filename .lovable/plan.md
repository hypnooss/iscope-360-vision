

# Fix: Heartbeat nao detecta tasks do Attack Surface para Super Agent

## Problema
A funcao RPC `rpc_agent_heartbeat` conta tarefas pendentes apenas na tabela `agent_tasks`:

```text
SELECT COUNT(*) INTO v_pending_count
FROM agent_tasks
WHERE agent_id = p_agent_id AND status = 'pending' AND expires_at > NOW();
```

Porem, as tasks do Attack Surface ficam em uma tabela separada: `attack_surface_tasks`. Como o Super Agent nunca tem registros em `agent_tasks`, o heartbeat sempre retorna `has_pending_tasks=False`, e o Python agent pula a etapa de buscar tarefas (linha 126 do `main.py`).

## Solucao

Alterar a funcao RPC `rpc_agent_heartbeat` para, quando o agente for `is_system_agent=true`, tambem verificar a tabela `attack_surface_tasks` por tasks com status `pending`.

### Alteracao no banco de dados (SQL)

Adicionar um check condicional na funcao:

```text
-- Apos o SELECT COUNT(*) existente em agent_tasks:
IF v_agent.is_system_agent THEN
  SELECT COUNT(*) INTO v_attack_pending
  FROM attack_surface_tasks
  WHERE status = 'pending';

  v_pending_count := v_pending_count + v_attack_pending;
END IF;
```

Isso requer:
1. Adicionar `is_system_agent` ao SELECT inicial do agente (ja existe na tabela, mas nao e consultado)
2. Declarar uma variavel `v_attack_pending INTEGER`
3. Adicionar o bloco IF acima apos a contagem de `agent_tasks`

### Arquivos alterados

- **Migration SQL**: Nova migration para atualizar a funcao `rpc_agent_heartbeat`
- Nenhuma alteracao no Python agent ou frontend necessaria

### Resultado esperado

Apos a correcao:
1. Heartbeat do Super Agent retorna `has_pending_tasks=True` quando existem tasks pendentes em `attack_surface_tasks`
2. Python agent detecta tasks pendentes e chama `rpc_get_agent_tasks`
3. A funcao `rpc_get_agent_tasks` ja possui a logica correta para Super Agents (claim de tasks com `FOR UPDATE SKIP LOCKED`)
4. Super Agent executa masscan, nmap, httpx e envia resultados
