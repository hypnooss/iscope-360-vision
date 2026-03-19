

## Terminal Remoto v2 — Conexão Instantânea via Supabase Realtime Broadcast

### Problema Atual
O terminal usa **HTTP polling a cada 2s** (ShellCommandPoller → GET/POST /agent-commands), gerando:
- Latência de 2-4s entre digitar e ver resultado
- Logs poluídos com GET/POST /agent-commands (como no print)
- Dependência desnecessária da tabela `agent_commands` para shell interativo

### Nova Arquitetura

```text
┌─────────────┐    Broadcast Channel     ┌─────────────┐
│   Browser    │ ◄══════════════════════► │ Python Agent │
│  (React UI)  │   shell:{agent_id}       │ (Supervisor) │
│              │                          │              │
│ send: cmd ──►│ ── event: "command" ──► │──► Popen     │
│              │                          │              │
│ ◄── output   │ ◄── event: "output" ──  │◄── stdout    │
│ ◄── error    │ ◄── event: "error"  ──  │◄── stderr    │
│ ◄── done     │ ◄── event: "done"   ──  │◄── exit_code │
└─────────────┘                          └─────────────┘
```

Comunicação **bidirecional instantânea** via WebSocket — zero polling, zero DB.

### Alterações

#### 1. Python Agent — Novo `realtime_shell.py`
- Conecta ao Supabase Realtime via WebSocket (usando `websockets` ou raw WS)
- Subscreve ao canal Broadcast `shell:{agent_id}`
- Ao receber evento `command`: executa via Popen com streaming
- Envia resultados parciais como eventos `output` (stdout) e `error` (stderr)
- Ao finalizar, envia evento `done` com exit_code e cwd
- Suporte a `__signal__`, `__probe__`, `cd`, `clear`
- Auto-desconecta após 120s de inatividade

#### 2. Python Agent — Atualizar `supervisor/main.py`
- Substituir `ShellCommandPoller` por `RealtimeShell`
- Quando heartbeat retorna `start_realtime=true`: conectar WebSocket
- Quando `start_realtime=false`: desconectar WebSocket

#### 3. Frontend — Reescrever `RemoteTerminal.tsx`
- Usar `supabase.channel('shell:{agentId}')` com Broadcast
- Enviar comandos via `channel.send({ type: 'broadcast', event: 'command', payload: { command, id } })`
- Receber resultados via listeners nos eventos `output`, `error`, `done`
- Remover dependência de `agent_commands` table e mutations
- Conexão instantânea — sem probe, sem polling
- Manter: histórico de comandos, Ctrl+C (via evento `signal`), Ctrl+L, auto-scroll

#### 4. Dependência Python
- Adicionar `websockets` ao `requirements.txt` (lib leve, sem dependências)

### Resultado
- **Latência**: de ~2-4s → ~50-100ms
- **Logs limpos**: sem GET/POST /agent-commands poluindo journalctl
- **Conexão instantânea**: WebSocket bidirecional, sem probe command

### Notas Técnicas
- O Supabase Realtime Broadcast não persiste dados — é fire-and-forget, ideal para shell interativo
- O canal é autenticado via ANON_KEY (já configurado no agent)
- Fallback: se WebSocket falhar, o terminal pode avisar e sugerir reconexão
- A tabela `agent_commands` continua existindo para comandos não-interativos (heartbeat-triggered)

