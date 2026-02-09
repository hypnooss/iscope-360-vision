

# Corrigir Split-Path no Executor PowerShell (usar -File em vez de -Command)

## Problema

O modulo `ExchangeOnlineManagement 3.9.2` usa internamente `Split-Path $PSScriptRoot`, que retorna string vazia quando o script e executado via `pwsh -Command "..."`. Isso causa o erro `Split-Path: Cannot bind argument to parameter 'Path' because it is an empty string` em todos os comandos Exchange.

O outro agente que funciona provavelmente usa uma versao diferente do modulo EXO que nao depende de `$PSScriptRoot`.

## Solucao

Alterar o executor (`python-agent/agent/executors/powershell.py`) para escrever o script em um arquivo temporario e executar com `-File` em vez de `-Command`. Isso garante que `$PSScriptRoot` seja populado corretamente pelo PowerShell.

## Mudanca Tecnica

### Arquivo: `python-agent/agent/executors/powershell.py`

Na funcao `run()`, linhas 296-308, substituir a execucao via `-Command` por:

1. Importar `tempfile` no topo do arquivo
2. Escrever o script em um arquivo `.ps1` temporario
3. Executar com `-File` em vez de `-Command`
4. Remover o arquivo temporario apos execucao

```python
import tempfile

# ... dentro de run():

# Write script to temp file (required for $PSScriptRoot support)
script_file = None
try:
    script_file = tempfile.NamedTemporaryFile(
        mode='w', suffix='.ps1', delete=False, dir=cwd or '/tmp'
    )
    script_file.write(script)
    script_file.close()

    result = subprocess.run(
        [pwsh_path, "-NoProfile", "-NonInteractive", "-File", script_file.name],
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=cwd
    )
finally:
    if script_file:
        try:
            os.unlink(script_file.name)
        except OSError:
            pass
```

5. Adicionar `import os` no topo (se nao existir)

## Impacto

- Compativel com todas as versoes do ExchangeOnlineManagement
- Nao afeta o comportamento de outros executores
- O outro agente que ja funciona com `-Command` continuara funcionando com `-File` sem problemas

