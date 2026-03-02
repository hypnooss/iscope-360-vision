

## Diagnóstico Final

O teste manual comprova: **Exchange funciona perfeitamente, resposta instantânea.** O problema é exclusivamente no agent.

### Causa Raiz: `Write-Output` é buffered no modo `-Command -`

No modo `pwsh -NonInteractive -Command -`, o PowerShell usa dois caminhos de output diferentes:

- **`[Console]::WriteLine()`** → escreve diretamente no file descriptor stdout → **chega no pipe imediatamente** (é assim que os markers `SESSION_READY` e `PIPE_TEST` funcionam)
- **`Write-Output`** → escreve no PowerShell Output Stream → **fica buffered internamente pelo .NET runtime** → só é flushed quando o pipeline fecha ou acumula buffer suficiente

O `_build_interactive_command` atual usa `Write-Output` para o JSON:
```
Write-Output (@{ 'name'='...'; 'success'=$true; 'data'=$__data } | ConvertTo-Json -Compress)
```

Esse `Write-Output` **nunca chega ao pipe** porque o .NET stdout StreamWriter não faz flush automático no modo pipeline. O `[Console]::Out.Flush()` depois do `CMD_END` só faz flush do stream do Console, não do stream do `Write-Output`.

### Solução

Trocar **todos os `Write-Output`** por **`[Console]::WriteLine()`** dentro do `_build_interactive_command`. Isso garante que tanto os markers quanto os dados JSON usem o mesmo caminho de output direto (unbuffered).

### Mudança no `_build_interactive_command`

```python
def _build_interactive_command(self, cmd_name, cmd_text):
    return (
        f'[Console]::WriteLine("{self.CMD_START_MARKER}")\n'
        f"[Console]::Out.Flush()\n"
        f"try {{\n"
        f"    $__data = ({cmd_text} | ConvertTo-Json -Depth 10 -Compress)\n"
        f"    $__json = (@{{ 'name'='{cmd_name}'; 'success'=$true; 'data'=$__data }} | ConvertTo-Json -Compress)\n"
        f"    [Console]::WriteLine($__json)\n"
        f"}} catch {{\n"
        f"    $__json = (@{{ 'name'='{cmd_name}'; 'success'=$false; 'error'=$_.Exception.Message }} | ConvertTo-Json -Compress)\n"
        f"    [Console]::WriteLine($__json)\n"
        f"}}\n"
        f'[Console]::WriteLine("{self.CMD_END_MARKER}")\n'
        f"[Console]::Out.Flush()\n"
    )
```

Isso é **1 linha de mudança** no arquivo `python-agent/agent/executors/powershell.py`.

