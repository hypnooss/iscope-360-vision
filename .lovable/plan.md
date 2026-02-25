

# Análise do Terminal Remoto — Problemas Encontrados

Analisei todos os componentes envolvidos: frontend (`RemoteTerminal.tsx`), edge function (`agent-commands/index.ts`), heartbeat (`agent-heartbeat/index.ts`), agent Python (`realtime_commands.py`, `remote_commands.py`, `supervisor/main.py`, `supervisor/config.py`), e as migrações de banco.

## Componentes verificados (OK)

| Componente | Status | Observação |
|---|---|---|
| Edge Function `agent-commands` | OK | GET busca pendentes + marca running. POST salva resultado. `verify_jwt = false` no config.toml |
| Edge Function `agent-heartbeat` | OK | Verifica `agent_commands` pendentes e retorna `has_pending_commands` |
| Realtime publication | OK | Migração `ALTER PUBLICATION supabase_realtime ADD TABLE agent_commands` existe |
| Frontend broadcast | OK | Canal `agent-cmd-{agentId}` com payload `{ id, command, timeout_seconds }` |
| Agent broadcast listener | OK | Topic `realtime:agent-cmd-{agent_id}` com protocolo Phoenix correto |
| Supervisor boot | OK | Inicializa `RealtimeCommandListener` com `agent_id`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| Frontend Realtime subscription | OK | Subscreve `postgres_changes` UPDATE em `agent_commands` filtrado por `agent_id` |
| RLS policies | OK | `super_admin` tem acesso total a `agent_commands` |
| Heartbeat fallback | OK | Supervisor chama `process_pending_commands()` quando `has_pending_commands=True` |

## BUG CRÍTICO: Execução duplicada de comandos (Race Condition)

Quando um comando chega via **broadcast Realtime**, o agent executa imediatamente via `_execute_command()`. Porém, o comando permanece com `status = 'pending'` no banco de dados durante a execução (o broadcast não marca o comando como `running`).

Se o **heartbeat** disparar durante esse intervalo (~1-2 segundos de execução):
1. O heartbeat detecta `has_pending_commands = True`
2. O supervisor chama `process_pending_commands()` → GET `/agent-commands`
3. A edge function retorna o mesmo comando (ainda `pending`) e marca como `running`
4. O agent executa o comando **uma segunda vez**

```text
Timeline do bug:

t=0s   Broadcast chega → _execute_command(cmd) inicia
t=0.1s subprocess.run() começa a executar
t=1s   Heartbeat dispara → has_pending_commands=True
t=1.1s GET /agent-commands → retorna mesmo comando (pending) → marca running
t=1.2s _execute_command(cmd) inicia NOVAMENTE
t=1.5s Primeiro _execute_command termina → POST resultado (completed)
t=2.5s Segundo _execute_command termina → POST resultado (sobrescreve!)
```

### Correção

Adicionar **tracking de comandos em execução** no `RemoteCommandHandler` para evitar duplicatas:

**Arquivo: `python-agent/agent/remote_commands.py`**
- Adicionar um `set()` de IDs em execução (`_running_ids`)
- No início de `_execute_command()`, verificar se o ID já está no set; se sim, ignorar
- Ao finalizar (sucesso, erro ou timeout), remover do set
- Usar um `threading.Lock` para thread-safety (Realtime e heartbeat rodam em threads diferentes)

```python
import threading

class RemoteCommandHandler:
    def __init__(self, api, logger):
        self.api = api
        self.logger = logger
        self._running_ids = set()
        self._lock = threading.Lock()

    def _execute_command(self, cmd: dict):
        command_id = cmd["id"]
        
        with self._lock:
            if command_id in self._running_ids:
                self.logger.info(f"[RemoteCmd] Comando {command_id[:8]}... já em execução, ignorando duplicata")
                return
            self._running_ids.add(command_id)
        
        try:
            # ... execução existente ...
        finally:
            with self._lock:
                self._running_ids.discard(command_id)
```

## BUG MENOR: Migração de Realtime pode falhar se já aplicada

A migração `20260225141307` faz `ALTER PUBLICATION supabase_realtime ADD TABLE agent_commands` sem verificar se já existe. Se for reaplicada, vai gerar erro.

### Correção

**Arquivo: nova migração** (substituir a existente não é possível se já foi aplicada)
- Usar padrão seguro com `IF NOT EXISTS` via bloco DO:

```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'agent_commands'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_commands;
  END IF;
END $$;
```

## Resumo das correções necessárias

| Arquivo | Tipo | Descrição |
|---|---|---|
| `python-agent/agent/remote_commands.py` | Edição | Adicionar deduplicação com `_running_ids` + `threading.Lock` |
| Nova migração SQL | Novo | Tornar a publicação Realtime idempotente (precaução) |

Nenhuma outra mudança necessária — o fluxo completo (frontend → broadcast → agent → execução → POST resultado → postgres_changes → frontend) está correto e funcional, exceto pelo bug de duplicação acima.

