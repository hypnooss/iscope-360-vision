

## Plano: Broadcast Wake + Terminal Pop-out — ✅ Implementado

### Parte 1 — Conexão instantânea via Broadcast Wake ✅

- **`python-agent/supervisor/realtime_listener.py`** — Novo. `RealtimeWakeListener` mantém conexão Realtime permanente escutando evento `wake` no canal `shell:{agent_id}`.
- **`python-agent/supervisor/main.py`** — Integrado: inicia o WakeListener no boot; no loop principal verifica `wake_event` e inicia RealtimeShell instantaneamente.
- **`src/components/agents/RemoteTerminal.tsx`** — Envia evento `wake` via broadcast após subscribe no canal.
- **`supabase/functions/agent-heartbeat/index.ts`** — Mantido como fallback (sem alteração).

### Parte 2 — Botão Pop-out ✅

- **`src/pages/TerminalPopoutPage.tsx`** — Nova página fullscreen com `RemoteTerminal`.
- **`src/App.tsx`** — Rota `/terminal/:id` adicionada.
- **`src/components/agents/RemoteTerminal.tsx`** — Botão `ExternalLink` na title bar abre `window.open()` e desconecta o terminal embutido.
