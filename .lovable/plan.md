

## Plano: Broadcast Wake + Terminal Pop-out

### Parte 1 — Conexão instantânea via Broadcast Wake

**Problema**: O Supervisor só detecta `shell_session_active` no heartbeat (até 120s de espera).

**Solução**: O Supervisor mantém uma conexão Realtime leve permanente, escutando o evento `wake` no canal `shell:{agent_id}`. Quando a UI envia `wake`, o Supervisor inicia o RealtimeShell imediatamente.

**Arquivos a alterar:**

| Arquivo | Mudança |
|---------|---------|
| `python-agent/supervisor/main.py` | Criar e manter um "listener" Realtime permanente no loop principal. Ao receber `wake`, iniciar RealtimeShell instantaneamente (sem esperar heartbeat). |
| `python-agent/supervisor/realtime_listener.py` | **Novo arquivo.** Classe leve que conecta ao canal `shell:{agent_id}` via WebSocket e escuta apenas o evento `wake`. Callback dispara flag que o main loop verifica. |
| `src/components/agents/RemoteTerminal.tsx` | Após subscribir no canal, enviar evento `wake` via broadcast. Remover a dependência de `shell_session_active` para iniciar a conexão (manter apenas como fallback/cleanup). |
| `supabase/functions/agent-heartbeat/index.ts` | Manter a lógica de `shell_session_active` → `start_realtime` como fallback (caso o listener não esteja ativo). |

**Fluxo novo:**
```text
UI subscribe canal → UI envia "wake" → Listener recebe → Supervisor inicia RealtimeShell → "ready" → UI libera input
Tempo estimado: ~1-3s (vs ~120s atual)
```

---

### Parte 2 — Botão Pop-out (desacoplar terminal)

**Solução**: Usar `window.open()` para abrir o terminal numa janela independente numa rota dedicada `/terminal/:agentId`. A conexão WebSocket vive na nova janela, permitindo navegar livremente na janela principal.

**Arquivos a alterar:**

| Arquivo | Mudança |
|---------|---------|
| `src/pages/TerminalPopoutPage.tsx` | **Nova página.** Renderiza o `RemoteTerminal` em tela cheia (sem AppLayout), com fundo preto. Lê `agentId` e `agentName` dos params/query. |
| `src/App.tsx` | Adicionar rota `/terminal/:id`. |
| `src/components/agents/RemoteTerminal.tsx` | Adicionar botão de pop-out na title bar (ícone `ExternalLink`). Ao clicar, abre `window.open('/terminal/{agentId}?name={agentName}')` e desconecta o terminal embutido. |

---

### Detalhes técnicos

**Realtime Listener (Supervisor)**:
- Usa `websocket-client` (já é dependência) para conectar ao Supabase Realtime
- Escuta apenas o evento `wake` — não executa comandos
- Thread daemon leve, reconecta automaticamente
- Quando recebe `wake`, seta uma flag `threading.Event` que o main loop lê a cada iteração (sem esperar o heartbeat)

**Pop-out**:
- A nova janela herda a sessão do Supabase (mesmo domínio, mesmo localStorage)
- O terminal embutido na página do agent se desconecta ao abrir o pop-out
- A janela pop-out usa título `Terminal — {agentName}` no `document.title`

