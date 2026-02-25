

## Diagnóstico: Por que Ctrl+C não funciona

O problema é **arquitetural**, não de código de sinalização. O fluxo atual:

```text
Poller thread (2s loop)
  -> _poll_once()
     -> GET /agent-commands  (retorna [curl ...])
     -> _execute_command(curl)  ← BLOQUEIA AQUI por 60s+
        -> while proc.poll() is None:  ← loop infinito de streaming
           -> sleep(2)
           -> (nunca retorna enquanto curl roda)
  
  // O poller NUNCA volta a fazer GET enquanto curl está rodando
  // Então __signal__ SIGINT fica como "pending" no banco, sem ser lido
```

O comando `__signal__ SIGINT` é inserido no DB, mas o poller está **travado** dentro do `_execute_command` do `curl`. Ele não consegue buscar novos comandos até o atual terminar. O sinal nunca chega.

## Solução

Executar cada comando em uma **thread separada** para que o poller continue livre para buscar novos comandos (incluindo sinais).

### Mudanças

**`python-agent/agent/realtime_commands.py`** — Executar comandos em threads:

```python
for cmd in commands:
    # Executa em thread para não bloquear o poller
    t = threading.Thread(
        target=self.handler._execute_command,
        args=(cmd,),
        daemon=True,
        name=f"cmd-{cmd['id'][:8]}"
    )
    t.start()
```

O dedup já existe (`_running_ids` com lock) no `RemoteCommandHandler`, então não há risco de executar o mesmo comando duas vezes.

**`python-agent/agent/remote_commands.py`** — Nenhuma mudança estrutural necessária. O código de sinal já funciona — ele só nunca era alcançado porque o poller estava bloqueado.

**`src/components/agents/RemoteTerminal.tsx`** — Ao enviar `__signal__ SIGINT`, também limpar `pendingCommandIds` localmente após um timeout curto (3s), para que o prompt reapareça mesmo se o agente demorar para reportar o status final. Isso resolve o caso do "prompt sumiu para sempre".

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `realtime_commands.py` | Importar `threading`; executar `_execute_command` em thread daemon |
| `RemoteTerminal.tsx` | Após Ctrl+C, forçar limpeza de `pendingCommandIds` após 3s como fallback |

### Fluxo corrigido

```text
Poller thread (2s loop)
  -> _poll_once()
     -> GET /agent-commands  (retorna [curl ...])
     -> Thread("cmd-abc12345") -> _execute_command(curl)  ← thread separada
  -> sleep(2)
  -> _poll_once()  ← poller volta imediatamente!
     -> GET /agent-commands  (retorna [__signal__ SIGINT])
     -> Thread("cmd-def67890") -> _execute_command(__signal__)
        -> detecta __signal__
        -> os.killpg(pgid, SIGINT)  ← mata curl
        -> curl thread sai do streaming loop
        -> reporta resultado final
```

