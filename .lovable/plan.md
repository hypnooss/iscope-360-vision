
# Correcao do erro "Access to path '/home/iscope' is denied" no PowerShell

## Problema

O script PowerShell gerado pelo executor tenta criar `$env:HOME` (linha 6 do script gerado). Embora o executor Python injete `HOME=/var/lib/iscope-agent` no ambiente do subprocess, o PowerShell esta resolvendo `$env:HOME` como `/home/iscope` (o home definido no `/etc/passwd` do usuario `iscope`). O usuario `iscope` nao tem permissao para criar `/home/iscope`, resultando em erro em todos os comandos Exchange.

## Causa Raiz

O agente no servidor pode estar rodando uma versao anterior a v1.2.6 (que introduziu a injecao de `HOME` no env). Alem disso, o script PowerShell gerado depende de `$env:HOME` para decidir qual diretorio criar, o que e fragil.

## Solucao

Duas alteracoes no arquivo `python-agent/agent/executors/powershell.py`:

### 1. Remover o bloco New-Item do script PowerShell gerado

O trecho nas linhas 138-141 da funcao `_build_script` (que gera o PowerShell) faz:

```
if (-not (Test-Path $env:HOME)) {
    New-Item -ItemType Directory -Path $env:HOME -Force | Out-Null
}
```

Substituir por um override direto de `$env:HOME` no proprio script PowerShell, sem tentar criar diretorios:

```
$env:HOME = '/var/lib/iscope-agent'
```

Isso garante que mesmo se o env do subprocess falhar, o PowerShell usara o caminho correto. O diretorio `/var/lib/iscope-agent` ja existe e pertence ao usuario `iscope`.

### 2. Manter a injecao de HOME no env do subprocess (ja existe)

A linha 320 (`env["HOME"] = "/var/lib/iscope-agent"`) permanece como camada adicional de seguranca.

## Resultado

O script PowerShell gerado passara de:

```powershell
# Ensure HOME directory exists (EXO 3.9+ requires valid HOME for Split-Path)
if (-not (Test-Path $env:HOME)) {
    New-Item -ItemType Directory -Path $env:HOME -Force | Out-Null
}
```

Para:

```powershell
# Override HOME to agent state dir (EXO 3.9+ requires valid HOME for Split-Path)
$env:HOME = '/var/lib/iscope-agent'
```

## Detalhes Tecnicos

- Arquivo: `python-agent/agent/executors/powershell.py`
- Linhas afetadas: 138-141 (dentro de `_build_script`)
- Alterar 4 linhas do array `script_parts` para 1 linha com o override direto
- Incrementar versao em `python-agent/agent/version.py` para `1.2.7`
