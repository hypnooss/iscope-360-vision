

## Diagnóstico: Por que `denied_traffic` falha com HTTP 404

### Causa raiz confirmada

A sequência real de execução é:

```text
1. Memory endpoint → HTTP 200, 0 resultados (sucesso)
2. Fallback acionado (0 resultados + fallback_path configurado)
3. Disk endpoint → HTTP 404 (não existe disco neste firewall)
4. Resultado do disk SOBRESCREVE o resultado do memory
5. Step reportado como "failed: HTTP 404" ← erro incorreto
```

O problema **não é** no endpoint de memória. O memory retorna corretamente. O problema é que o código tenta o fallback para disco, o disco retorna 404, e esse erro substitui o resultado válido do memory.

### Correção proposta

**Arquivo:** `python-agent/agent/executors/http_request.py`, método `run()`, linhas 68-82.

**Lógica atual (com bug):**
- Memory retorna 0 resultados → aciona fallback
- Fallback (disk) falha com 404 → resultado do disk sobrescreve o do memory
- Step reportado como `failed`

**Nova lógica:**
- Memory retorna 0 resultados → aciona fallback
- Se o fallback **também falhar** (404, timeout, etc.) → **manter o resultado original do memory** (que era um sucesso com 0 resultados)
- Só substituir pelo resultado do disk se o disk **retornar com sucesso**

### Implementação

Modificar o bloco de fallback no método `run()` para salvar o resultado original do memory antes de tentar o fallback, e restaurá-lo caso o disk falhe:

```python
# Fallback: if memory returned 0 results and fallback_path exists, try disk
if self._should_fallback(result, config, context):
    fallback_url = self._build_fallback_url(url, config, context)
    self.logger.info(...)
    fallback_result = self._paginated_request(...)
    
    # Only use fallback result if it succeeded
    if not fallback_result.get('error'):
        result = fallback_result
        if result.get('data') and isinstance(result['data'], dict):
            result['data']['_source'] = 'disk'
    else:
        self.logger.info(
            f"Step {step_id}: Disk fallback failed ({fallback_result.get('error')}), "
            f"keeping memory result"
        )
        if result.get('data') and isinstance(result['data'], dict):
            result['data']['_source'] = 'memory'
```

### Impacto

- Firewalls **sem disco**: `denied_traffic` (e outros steps com `fallback_path`) deixarão de falhar incorretamente. Retornarão `success` com 0 resultados.
- Firewalls **com disco**: comportamento mantido — se o disco tiver dados, serão usados normalmente.
- Sem risco de regressão: a única mudança é não sobrescrever um sucesso com um erro.

### Detalhes técnicos

- Arquivo único a alterar: `python-agent/agent/executors/http_request.py`
- Bloco afetado: linhas 68-82 do método `run()`
- Nenhuma alteração necessária em `tasks.py`, blueprints ou UI

