

## Fix: Comandos não exibem output (tail, top, ip a)

### Problema
O `_execute_command` usa `subprocess.Popen` com `subprocess.PIPE` + `text=True`. Isso causa dois problemas:

1. **Sem PTY**: Comandos como `top` e `tail -f` detectam que não há terminal e se comportam diferente (buffering completo, saída suprimida, ou erro)
2. **Buffering**: Com `text=True` + PIPE, o Python usa buffering completo (não line-buffering). O `select.select` em pipes de texto pode não funcionar como esperado — `readline()` bloqueia até receber `\n`, e o output fica preso no buffer interno do processo filho
3. **`ip a`**: output é curto mas fica preso no buffer até o processo terminar — e o `_read_available` com `select` + `readline` em pipe texto pode não detectar dados disponíveis

### Solução: Usar PTY (pseudo-terminal)

Substituir `subprocess.PIPE` por `pty.openpty()` no `realtime_shell.py`. Isso:
- Aloca um pseudo-terminal real → comandos como `top`, `htop`, `tail -f` funcionam
- Força line-buffering automático (como num terminal real)
- `select.select` funciona corretamente no file descriptor do PTY
- Output chega imediatamente, sem buffering

### Alterações

#### 1. `python-agent/supervisor/realtime_shell.py`

- Importar `pty`, `os`, `fcntl`
- No `_execute_command`, substituir `subprocess.Popen(..., stdout=PIPE, stderr=PIPE)` por:
  - Criar PTY com `pty.openpty()` → `(master_fd, slave_fd)`
  - Usar `slave_fd` como stdin/stdout/stderr do Popen
  - Ler do `master_fd` com `os.read()` (bytes, não text) via `select.select`
  - Decodificar como UTF-8 com `errors='replace'`
- Remover `_read_available` estático (não mais necessário)
- Enviar todo output como evento `output` (PTY combina stdout+stderr)
- Configurar o PTY como non-blocking com `fcntl`
- No `_handle_signal`, enviar signal via `os.killpg` (já funciona)

#### 2. Bump versão Supervisor
- `1.1.0` → `1.1.1`

### Resultado
- `ip a`, `ls`, `cat` → output instantâneo
- `tail -f` → streaming em tempo real
- `top` → output contínuo (atualiza a cada refresh)
- `Ctrl+C` → mata o processo normalmente

