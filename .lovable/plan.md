
# Corrigir deteccao de erro de permissao no nmap_discovery

## Problema

O `nmap_discovery.py` detecta erroneamente "permission denied" no stderr do nmap e faz fallback desnecessario para `-sT`, mesmo quando o `sudo` esta funcionando corretamente.

A logica atual (linha 230) faz um `in stderr.lower()` muito generico -- qualquer ocorrencia de "permission denied" em qualquer linha do stderr dispara o fallback. O nmap 7.80 pode emitir mensagens como:
- `"pcap_open_live: permission denied"` em contextos parciais
- Warnings sobre arquivos de configuracao
- Mensagens sobre raw sockets que contem essas frases

Enquanto isso, o `sudo` esta funcionando perfeitamente (confirmado nos testes manuais).

## Solucao

1. **Adicionar log do stderr completo** antes da verificacao, para diagnostico
2. **Restringir a deteccao de permissao** para verificar apenas o `returncode` do nmap (exit code 1) combinado com as frases especificas, e ignorar se o comando comeca com `sudo` e o exit code e 0

### Arquivo: `python-agent/agent/executors/nmap_discovery.py`

**Mudanca 1: Adicionar log de debug do comando e stderr (linhas 219-228)**

Antes do check de permissao, logar o comando executado e o stderr para facilitar diagnostico:

```python
result = subprocess.run(
    cmd,
    capture_output=True,
    text=True,
    timeout=timeout,
)

stderr = result.stderr.strip() if result.stderr else ''

# Debug: log command and result for troubleshooting
self.logger.info(
    f"[nmap_discovery] cmd={'sudo ' if cmd[0] == 'sudo' else ''}"
    f"nmap {cmd[-1]}, exit={result.returncode}, "
    f"stderr_len={len(stderr)}"
)
```

**Mudanca 2: Refinar deteccao de permissao (linhas 229-239)**

Trocar a logica de substring match generico para verificar o `returncode` junto com as frases. Se o nmap retornou exit code 0, o scan funcionou -- nao e erro de permissao:

```python
# Detect permission error for -sS fallback
# Only treat as permission error if nmap actually failed (non-zero exit)
if result.returncode != 0 and stderr and any(
    phrase in stderr.lower()
    for phrase in [
        'requires root',
        'operation not permitted',
        'you requested a scan type which requires root',
    ]
):
    self.logger.warning(
        f"[nmap_discovery] Permission error on {ip}: {stderr[:200]}"
    )
    return 'PERMISSION_ERROR'
```

Mudancas chave:
- Adicionado `result.returncode != 0` como condicao obrigatoria
- Removido `'permission denied'` da lista (muito generico, aparece em contextos nao relacionados)
- Adicionado log do stderr truncado quando detecta erro de permissao

## Resumo

| Arquivo | Acao |
|---|---|
| `python-agent/agent/executors/nmap_discovery.py` | Adicionar log de debug; refinar deteccao de `PERMISSION_ERROR` para exigir exit code != 0 e remover match generico de "permission denied" |
