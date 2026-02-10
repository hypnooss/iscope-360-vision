

# Corrigir: Execucao PowerShell em batch falhando com "No result found"

## Problema identificado

Apos a introducao do batch execution (18 comandos Exchange em uma unica sessao PowerShell), TODOS os comandos retornam "No result found for command 'xxx'". O problema ocorre em dois niveis:

### Nivel 1 - PowerShell produz output extra (causa raiz)
Quando 18 comandos rodam em uma unica sessao, o PowerShell pode emitir warnings, mensagens de modulo ou output verbose no stdout antes do JSON final. Isso faz com que `json.loads(output)` falhe.

### Nivel 2 - Executor retorna raw sem flag de erro (bug defensivo)
Quando o parse JSON falha, o executor retorna `{"data": output_string, "raw": True}` sem uma chave `error`. O batch unpacker verifica `result.get('error')` na linha 418, que retorna `None`, entao prossegue normalmente. Na linha 449, `isinstance(data, dict)` retorna `False` (porque `data` e uma string), e todos os 18 comandos caem no else com "No result found".

```text
Fluxo do Bug:

PowerShell stdout:  "WARNING: algo...\n{\"exo_mailbox_forwarding\": {...}}"
                          |
                    json.loads() falha
                          |
              Retorna {"data": string, "raw": True}  (sem "error")
                          |
              Batch unpacker: result.get('error') = None -> OK
                          |
              data = result.get('data') -> string (nao dict)
                          |
              isinstance(data, dict) = False -> "No result found" x18
```

## Solucao

### 1. PowerShell: Marcador de delimitacao no output

Adicionar um marcador unico antes do JSON final para que o executor possa extrair apenas o JSON, ignorando qualquer output anterior.

**Arquivo:** `python-agent/agent/executors/powershell.py`

No metodo `_build_script`, alterar a secao de output final de:
```python
"$results | ConvertTo-Json -Depth 10 -Compress"
```
Para:
```python
"Write-Output '---ISCOPE_JSON_START---'",
"$results | ConvertTo-Json -Depth 10 -Compress",
```

No metodo `run`, antes de fazer `json.loads`, extrair apenas o conteudo apos o marcador:
```python
output = result.stdout.strip()
marker = '---ISCOPE_JSON_START---'
if marker in output:
    output = output.split(marker, 1)[1].strip()
```

### 2. Batch unpacker: Tratar `raw` como erro

**Arquivo:** `python-agent/agent/tasks.py`

No metodo `_execute_powershell_batch`, apos a chamada `executor.run()` e antes do unpack dos resultados individuais, adicionar verificacao do flag `raw`:

```python
# Apos linha 418 (check batch-level error)
if result.get('raw'):
    error_msg = f"PowerShell output is not valid JSON: {str(result.get('data', ''))[:200]}"
    # ... tratar como erro de batch (mesmo padrao do bloco acima)
```

### 3. Bump de versao

**Arquivo:** `python-agent/agent/version.py`

Atualizar `__version__` de `"1.2.6"` para `"1.2.7"` para que os agentes no campo recebam a atualizacao automaticamente.

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `python-agent/agent/executors/powershell.py` | Marcador de delimitacao no output + extracao do JSON |
| `python-agent/agent/tasks.py` | Tratar flag `raw` como erro no batch unpacker |
| `python-agent/agent/version.py` | Bump para 1.2.7 |

## Resultado esperado

- Mesmo que o PowerShell emita warnings no stdout, o JSON sera extraido corretamente pelo marcador
- Se o marcador nao estiver presente (fallback), o comportamento atual de parse e mantido
- Se o parse falhar mesmo assim, o batch unpacker exibe um erro claro em vez de falhar silenciosamente com "No result found"
- Agentes receberao a atualizacao automaticamente via heartbeat

