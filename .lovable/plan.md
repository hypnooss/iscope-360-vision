

# Corrigir Split-Path: Garantir HOME valido no script PowerShell

## Causa raiz confirmada

O diretorio `/home/iscope/` **nao existe** no NEXTA-AAX. O modulo ExchangeOnlineManagement 3.9.2 executa `Split-Path` em um caminho derivado de `$env:HOME` durante o `Import-Module`, e quando o diretorio nao existe, o path resolve para string vazia, causando o erro.

**Evidencia**: O erro ocorre na linha `Import-Module ExchangeOnlineManagement`, antes mesmo de qualquer `Connect-ExchangeOnline`.

No TASCHIBRA-IDA, `/home/iscope/` existe, por isso funciona.

## Correcao imediata (no servidor NEXTA-AAX)

```text
mkdir -p /home/iscope && chown iscope:iscope /home/iscope
systemctl restart iscope-agent
```

## Mudanca no codigo (prevencao)

### Arquivo: `python-agent/agent/executors/powershell.py`

Adicionar um preambulo no metodo `_build_script` que garante que `$env:HOME` aponte para um diretorio existente antes de importar qualquer modulo:

```text
# Ensure HOME directory exists (EXO 3.9+ requires valid HOME for Split-Path)
if (-not (Test-Path $env:HOME)) {
    New-Item -ItemType Directory -Path $env:HOME -Force | Out-Null
}
```

Este bloco sera inserido no inicio do script gerado, antes da linha `Import-Module`, dentro do array `script_parts`.

### Arquivo: `python-agent/agent/version.py`

Incrementar para `1.2.7`.

### Arquivo: `python-agent/agent/executors/powershell.py` (revert parcial)

Manter os templates `CertificateFilePath` como estao atualmente (corretos).

## Resumo das mudancas

| Arquivo | Mudanca |
|---------|---------|
| `powershell.py` | Adicionar bloco de 3 linhas no inicio do script PS1 gerado |
| `version.py` | `1.2.6` para `1.2.7` |

## Secao tecnica

O bloco sera inserido apos as linhas de `$ErrorActionPreference` e `$ProgressPreference`, antes do `Import-Module`. Isso garante que qualquer modulo PowerShell que dependa de `$env:HOME` (EXO, MgGraph, etc.) encontre o diretorio disponivel.

