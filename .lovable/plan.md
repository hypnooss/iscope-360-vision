

## Diagnóstico: `[Console]::SetOut()` pode estar quebrando o pipe

O problema de zero output persiste porque o `Write-Output` do PowerShell **não usa `[Console]::Out`**. Ele escreve no pipeline stream do host, que tem seu próprio `TextWriter` interno. O `[Console]::SetOut($sw)` muda o `Console.Out` mas o host do PowerShell já cacheou o writer original no startup — então:

1. O `SetOut` com novo StreamWriter pode ter **desconectado** o `Console.Out` do pipe real
2. `Write-Output` continua usando o writer interno do host (o original, sem AutoFlush)
3. `[Console]::Out.Flush()` agora faz flush do NOVO StreamWriter, que pode nem estar conectado ao pipe que Python lê

```text
Python stdin pipe → pwsh
                     │
                     ├─ Host internal writer (original Console.Out) → Python stdout pipe
                     │    └─ Write-Output usa ESTE ← block-buffered, sem flush
                     │
                     └─ $sw (novo StreamWriter via SetOut) → ???
                          └─ [Console]::Out.Flush() faz flush DESTE ← não ajuda
```

## Correção: 3 mudanças em `powershell.py`

### 1. Remover o hack `SetOut` e usar `[Console]::WriteLine()` para markers

`[Console]::WriteLine()` escreve diretamente no stdout real, **bypassa o pipeline** do PowerShell. Combinado com flush do `Console.Out` original (sem SetOut), garante entrega imediata.

No `_build_interactive_preamble` — remover as 4 linhas do SetOut e mudar o marker:

```python
lines = [
    "$ErrorActionPreference = 'Continue'",
    "$ProgressPreference = 'SilentlyContinue'",
    # ... resto do preamble ...
]

# No final:
lines.extend([
    "",
    f'[Console]::WriteLine("{self.SESSION_READY_MARKER}")',
    "[Console]::Out.Flush()",
])
```

### 2. Usar `[Console]::WriteLine()` para TODOS os markers em `_build_interactive_command`

Os markers (CMD_START, CMD_END) usam `[Console]::WriteLine()` em vez de `Write-Output`. O JSON de dados continua com `Write-Output` (vai pelo pipeline normal):

```python
def _build_interactive_command(self, cmd_name, cmd_text):
    return (
        f"try {{\n"
        f"    $__data = ({cmd_text} | ConvertTo-Json -Depth 10 -Compress)\n"
        f'    [Console]::WriteLine("{self.CMD_START_MARKER}")\n'
        f"    Write-Output (@{{ ... }} | ConvertTo-Json -Compress)\n"
        f'    [Console]::WriteLine("{self.CMD_END_MARKER}")\n'
        f"    [Console]::Out.Flush()\n"
        f"}} catch {{\n"
        f'    [Console]::WriteLine("{self.CMD_START_MARKER}")\n'
        f"    Write-Output (@{{ ... }} | ConvertTo-Json -Compress)\n"
        f'    [Console]::WriteLine("{self.CMD_END_MARKER}")\n'
        f"    [Console]::Out.Flush()\n"
        f"}}\n"
    )
```

### 3. Mesmo para `_drain_and_sync`

```python
sync_cmd = f'[Console]::WriteLine("{self.SYNC_MARKER}")\n[Console]::Out.Flush()\n'
```

### 4. Adicionar logging ao reader thread

Para diagnóstico imediato, cada linha lida é logada em DEBUG:

```python
def _reader():
    try:
        for line in iter(stdout.readline, ''):
            self.logger.debug(f"[PS stdout] {line.rstrip()}")
            q.put(line)
    except Exception as e:
        self.logger.warning(f"Reader thread error: {e}")
    q.put(None)
```

### 5. Adicionar echo diagnóstico no início do preamble

Para verificar se o pipe funciona, um `[Console]::WriteLine()` simples logo no início:

```python
lines = [
    '[Console]::WriteLine("---ISCOPE_PIPE_TEST---")',
    "[Console]::Out.Flush()",
    "$ErrorActionPreference = 'Continue'",
    # ...
]
```

E no `run_interactive`, logo após enviar o preamble, logar se algo chega:

```python
proc.stdin.write(preamble)
proc.stdin.flush()
self.logger.info("Preamble sent, waiting for session ready...")
```

## Resumo

| Local | Antes | Depois |
|-------|-------|--------|
| Preamble (início) | `SetOut` com novo StreamWriter | Removido (echo diagnóstico simples) |
| Markers (SESSION_READY, CMD_START, CMD_END, SYNC) | `Write-Output` | `[Console]::WriteLine()` |
| Reader thread | Silencioso | Loga cada linha em DEBUG |
| Dados JSON | `Write-Output` | `Write-Output` (sem mudança) |

## Por que vai funcionar

- `[Console]::WriteLine()` escreve direto no stdout file descriptor, sem passar pelo pipeline do PowerShell
- `[Console]::Out.Flush()` faz flush do `Console.Out` ORIGINAL (sem SetOut interferindo)
- O JSON continua fluindo pelo pipeline, mas fica entre markers que são entregues imediatamente
- O reader thread com logging permite diagnóstico em tempo real

