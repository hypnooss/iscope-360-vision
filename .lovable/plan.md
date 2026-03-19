

## Ajuste de Versão e Mover `realtime_shell.py` para `supervisor/`

### Problema
O `realtime_shell.py` está em `agent/` mas é usado exclusivamente pelo Supervisor. Isso cria uma dependência cruzada que obriga a atualizar o Agent antes do Supervisor.

### Alterações

#### 1. Mover `realtime_shell.py` de `agent/` para `supervisor/`
- Criar `python-agent/supervisor/realtime_shell.py` (cópia exata do conteúdo atual)
- Esvaziar `python-agent/agent/realtime_shell.py` (manter arquivo vazio ou deletar)

#### 2. Atualizar import em `supervisor/main.py`
- Trocar `from agent.realtime_shell import RealtimeShell` → `from supervisor.realtime_shell import RealtimeShell`

#### 3. Bump de versão
- **Supervisor**: `1.0.0` → `1.1.0` (nova funcionalidade: Realtime Shell)
- **Agent**: `1.3.11` → `1.3.12` (remoção do `realtime_shell.py` que não pertencia ao Agent)

#### 4. Atualizar `_index.ts`
- Remover referência a `agent/realtime_shell.py` se existir
- Adicionar `supervisor/realtime_shell.py` à lista

### Ordem de Deploy
Com esta mudança, **a ordem de deploy não importa mais** — cada pacote é independente.

