

## O problema real: os markers chegam mas NÃO fazem match

O log prova que o pipe funciona — ambos os markers chegam:
```
---ISCOPE_PIPE_TEST---
---ISCOPE_SESSION_READY---
```

Mas `_read_until_marker` retorna `found=False` com ambos na lista `lines`. Isso significa que `line_clean == marker` é `False` mesmo com strings visualmente idênticas.

## Duas causas prováveis (ambas serão corrigidas)

### 1. Encoding mismatch no Popen

`text=True` sem `encoding` explícito usa `locale.getpreferredencoding()`. Se o locale do sistema não for UTF-8 (ex: `POSIX`, `C`, `ASCII`), caracteres podem ser decodificados incorretamente. Além disso, `.NET` pode emitir bytes que o codec do locale não interpreta como esperado.

### 2. Comparação frágil `==` com caracteres residuais

A `_sanitize_line` remove BOM, ANSI e null bytes, mas pode haver outros caracteres invisíveis (carriage return `\r`, soft hyphen, zero-width spaces, etc.) que sobrevivem ao `strip()`.

## Correções em `python-agent/agent/executors/powershell.py`

### 1. Forçar UTF-8 no Popen (linha 433-442)

```python
proc = subprocess.Popen(
    [pwsh, "-NoProfile", "-NonInteractive", "-Command", "-"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    encoding='utf-8',
    errors='replace',
    cwd=cwd,
    env=env,
    bufsize=1,
)
```

### 2. Sanitização agressiva + comparação com `in` (linhas 288-293, 338-341)

```python
def _sanitize_line(self, line: str) -> str:
    line = line.replace('\ufeff', '')
    line = line.replace('\x00', '')
    line = line.replace('\r', '')
    line = self.ANSI_ESCAPE_RE.sub('', line)
    # Remove ALL non-printable characters
    line = ''.join(c for c in line if c.isprintable() or c in ('\n', '\t'))
    return line.strip()
```

E na comparação em `_read_until_marker`:

```python
line_clean = self._sanitize_line(line)
if marker in line_clean or line_clean == marker:
    return (True, "\n".join(lines))
```

### 3. Diagnóstico em INFO (não DEBUG) no reader thread (linhas 304-308)

O nível de log do agente é INFO, então logs DEBUG nunca aparecem. Mudar para INFO temporariamente:

```python
def _reader():
    try:
        for line in iter(stdout.readline, ''):
            self.logger.info(f"[PS raw] {repr(line)}")
            q.put(line)
    except Exception as e:
        self.logger.warning(f"Reader thread error: {e}")
    q.put(None)
```

Isso vai finalmente mostrar os bytes EXATOS que chegam do PowerShell.

### 4. Adicionar `PYTHONIOENCODING=utf-8` ao env do processo (segurança extra)

```python
env = os.environ.copy()
env["HOME"] = "/var/lib/iscope-agent"
env["PYTHONIOENCODING"] = "utf-8"
env["DOTNET_SYSTEM_CONSOLE_ALLOW_ANSI_COLOR_REDIRECTION"] = "0"
```

O `DOTNET_SYSTEM_CONSOLE_ALLOW_ANSI_COLOR_REDIRECTION=0` desativa ANSI codes do .NET quando stdout não é TTY.

## Resumo

| Mudança | Propósito |
|---------|-----------|
| `encoding='utf-8', errors='replace'` no Popen | Eliminar locale mismatch |
| `DOTNET_SYSTEM_CONSOLE_ALLOW_ANSI_COLOR_REDIRECTION=0` | Desativar ANSI do .NET |
| Sanitização agressiva (non-printable chars) | Remover QUALQUER caractere invisível |
| `marker in line_clean` | Match resiliente |
| Reader thread em INFO com `repr()` | Diagnóstico visível no log |

