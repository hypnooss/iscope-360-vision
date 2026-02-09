

# Fix: PowerShell HOME directory - Solucao definitiva

## Problema raiz

O erro `Split-Path` ocorre porque o modulo ExchangeOnlineManagement (v3.9+) tenta resolver `$env:HOME`, que aponta para `/home/iscope` -- um diretorio que nao existe e que o user `iscope` nao consegue criar (so root pode criar em `/home`).

O `check-deps.sh` deveria criar esse diretorio como root via ExecStartPre, mas nao esta executando corretamente (sem output no components.log nas ultimas execucoes).

## Solucao

Em vez de depender do `check-deps.sh` ou de criar `/home/iscope`, vamos **redirecionar HOME para `/var/lib/iscope-agent`** diretamente no executor PowerShell. Esse diretorio ja existe e ja pertence ao user `iscope`.

## Alteracao

### `python-agent/agent/executors/powershell.py`

Na funcao `run()`, ao chamar `subprocess.run()` para executar o pwsh, passar uma copia do environment com `HOME=/var/lib/iscope-agent`:

```python
env = os.environ.copy()
env["HOME"] = "/var/lib/iscope-agent"

result = subprocess.run(
    [pwsh_path, "-NoProfile", "-NonInteractive", "-File", script_file.name],
    capture_output=True,
    text=True,
    timeout=timeout,
    cwd=cwd,
    env=env
)
```

Isso garante que:
- O PowerShell resolve `$env:HOME` para um diretorio que ja existe
- O modulo ExchangeOnlineManagement encontra um caminho valido para `Split-Path`
- Nao depende mais do check-deps.sh ou de permissoes root
- Funciona imediatamente apos o deploy, sem precisar de restart

### `python-agent/agent/version.py`

Atualizar versao para `1.2.6` (novo release necessario para o fix chegar aos agentes).

