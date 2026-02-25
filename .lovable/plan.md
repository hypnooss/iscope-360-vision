

# Terminal Remoto — Experiência de Shell Linux Virtual

## Conceito

Transformar o componente atual (input + lista de cards) em uma **experiência de shell Linux real**: fundo preto, texto verde/branco, prompt `root@agent-name:~#`, comandos e outputs renderizados sequencialmente como num terminal real. Botão "Conectar" inicia a sessão; botão "Desconectar" encerra.

```text
┌─────────────────────────────────────────────────────────────────┐
│  Terminal Remoto — OUROSAFRA-OCI            [● Conectado]  [✕] │
├─────────────────────────────────────────────────────────────────┤
│  root@OUROSAFRA-OCI:~# systemctl status iscope-agent           │
│  ● iscope-agent.service - iScope Agent                         │
│       Active: active (running) since Tue 2026-02-25 10:23:01   │
│       Main PID: 1234 (python3)                                 │
│                                                                 │
│  root@OUROSAFRA-OCI:~# cat /etc/os-release                    │
│  NAME="Ubuntu"                                                  │
│  VERSION="22.04.3 LTS"                                         │
│                                                                 │
│  root@OUROSAFRA-OCI:~# invalidcmd                              │
│  bash: invalidcmd: command not found                           │
│                                                                 │
│  root@OUROSAFRA-OCI:~# █                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Mudanças

### Arquivo único: `src/components/agents/RemoteTerminal.tsx` (reescrita)

**Estado da sessão:**
- Botão "Conectar" abre a sessão (estado `connected = true`), subscreve ao Realtime
- Botão "Desconectar" fecha a sessão, limpa o terminal
- Badge mostra "Conectado" (verde) / "Desconectado" (cinza)

**Layout de shell virtual:**
- Container com `bg-black rounded-lg font-mono text-sm text-green-400`
- Barra de título estilo terminal com nome do agent e botões de controle
- Área de output scrollável com auto-scroll para baixo (não para cima como hoje)
- Linhas de histórico: cada entrada mostra o prompt + comando + output inline
- Input invisível (sem borda) no final do terminal, precedido pelo prompt `root@{agentName}:~#`

**Renderização do output:**
- `stdout` renderizado em `text-gray-300` (branco/cinza)
- `stderr` renderizado em `text-red-400` (vermelho, como erros reais do bash)
- Exit code != 0 sem badge separado — o stderr já comunica o erro naturalmente
- Comandos pendentes mostram cursor piscante `▌` até completar
- Suporte a `clear` como comando local (limpa o histórico visual sem enviar ao agent)

**Histórico de comandos:**
- Array local `terminalLines[]` com tipo `{ type: 'input' | 'output' | 'error' | 'system', text: string }`
- Setas ↑/↓ navegam pelo histórico de comandos anteriores (como bash real)
- Ao conectar, carrega os últimos 20 comandos da sessão como contexto
- `Ctrl+L` limpa a tela (equivalente a `clear`)

**Realtime (sem mudanças no backend):**
- Mantém a mesma lógica de broadcast para envio instantâneo
- Mantém subscription de `postgres_changes` para receber resultados
- Quando resultado chega, adiciona stdout/stderr como linhas no terminal

### Fluxo visual

1. Usuário clica "Conectar" → terminal preto aparece com mensagem de boas-vindas
2. Prompt aparece: `root@OUROSAFRA-OCI:~# █`
3. Usuário digita `systemctl status iscope-agent` + Enter
4. Linha do comando fica fixa, cursor piscante aparece abaixo indicando "aguardando..."
5. ~1-2s depois, output aparece abaixo em cinza claro
6. Novo prompt aparece, pronto para o próximo comando
7. Se digitar comando inválido → stderr aparece em vermelho (ex: `bash: xyz: command not found`)

### Detalhes de implementação

- **Sem xterm.js** — componente React puro com divs e spans. Mais leve, sem dependências extras
- **Sem mudanças no backend** — toda a lógica é apenas reorganização visual do mesmo fluxo (insert → broadcast → result → display)
- **Comandos locais**: `clear` e `Ctrl+L` limpam a tela localmente; `exit` desconecta a sessão
- **Auto-scroll**: `scrollIntoView({ behavior: 'smooth' })` no ref do último elemento
- **Focus trap**: ao clicar em qualquer lugar do terminal, foca no input

