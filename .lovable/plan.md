

## Problema Real: stdout do PowerShell é block-buffered em pipes no Linux

O .NET (que roda o pwsh) usa **block buffering** no `Console.Out` quando o stdout não é um TTY. Isso significa:

```text
Python envia preamble via stdin
  → PowerShell executa Import-Module (OK)
  → PowerShell executa Connect-ExchangeOnline (~30-60s, OK)
  → PowerShell executa Write-Output "---ISCOPE_SESSION_READY---"
     → Output fica no buffer interno do .NET (~4KB) ← NÃO É FLUSHED
  → Reader thread: nada chega ao pipe
  → 120s depois: timeout com zero output capturado
```

O `Write-Output` envia texto para o pipeline do PowerShell, que eventualmente vai para stdout, mas o `StreamWriter` subjacente só faz flush quando o buffer enche (4KB) ou o processo termina. Como o marker tem ~30 bytes, nunca enche.

## Correção: `python-agent/agent/executors/powershell.py`

### 1. Adicionar auto-flush no início do preamble (`_build_interactive_preamble`, linhas 229-262)

Inserir no início do script (antes de qualquer Write-Output):

```python
lines = [
    # Force stdout auto-flush (critical for pipe communication on Linux)
    "[Console]::Out.Flush()",
    "$sw = [System.IO.StreamWriter]::new([Console]::OpenStandardOutput())",
    "$sw.AutoFlush = $true",
    "[Console]::SetOut($sw)",
    "",
    "$ErrorActionPreference = 'Continue'",
    # ... resto do preamble existente
]
```

Isso faz com que cada `Write-Output` seja imediatamente flushed para o pipe.

### 2. Adicionar flush explícito após o SESSION_READY_MARKER (linhas 257-260)

Adicionar `[Console]::Out.Flush()` como safety net após o marker:

```python
lines.extend([
    "",
    f'Write-Output "{self.SESSION_READY_MARKER}"',
    "[Console]::Out.Flush()",
])
```

### 3. Adicionar flush nos command wrappers (`_build_interactive_command`, linhas 264-277)

Após cada `CMD_END_MARKER`:

```python
def _build_interactive_command(self, cmd_name: str, cmd_text: str) -> str:
    return (
        f"try {{\n"
        f"    $__data = ({cmd_text} | ConvertTo-Json -Depth 10 -Compress)\n"
        f'    Write-Output "{self.CMD_START_MARKER}"\n'
        f"    Write-Output (@{{ 'name'='{cmd_name}'; 'success'=$true; 'data'=$__data }} | ConvertTo-Json -Compress)\n"
        f'    Write-Output "{self.CMD_END_MARKER}"\n'
        f"    [Console]::Out.Flush()\n"
        f"}} catch {{\n"
        f'    Write-Output "{self.CMD_START_MARKER}"\n'
        f"    Write-Output (@{{ 'name'='{cmd_name}'; 'success'=$false; 'error'=$_.Exception.Message }} | ConvertTo-Json -Compress)\n"
        f'    Write-Output "{self.CMD_END_MARKER}"\n'
        f"    [Console]::Out.Flush()\n"
        f"}}\n"
    )
```

### 4. Adicionar flush no sync marker (`_drain_and_sync`, linha 333)

```python
sync_cmd = f'Write-Output "{self.SYNC_MARKER}"\n[Console]::Out.Flush()\n'
```

## Resumo

| Local | Mudança |
|-------|---------|
| Preamble (início) | `[Console]::SetOut()` com AutoFlush=true |
| Preamble (SESSION_READY) | `[Console]::Out.Flush()` após marker |
| `_build_interactive_command` | `[Console]::Out.Flush()` após CMD_END |
| `_drain_and_sync` | `[Console]::Out.Flush()` após SYNC_MARKER |

## Impacto

- Resolve o problema de zero output em pipes no Linux
- Cada marker é imediatamente visível para a reader thread
- O `Connect-ExchangeOnline` agora pode levar os 30-60s normais sem triggering timeout
- Sem efeito colateral — o auto-flush apenas desativa o buffering desnecessário

