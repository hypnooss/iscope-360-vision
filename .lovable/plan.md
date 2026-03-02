

## Diagnóstico: O timeout agora funciona, mas a conexão falha genuinamente

A boa notícia: o fix da queue + stderr=STDOUT **está funcionando** — o timeout de 120s dispara corretamente (18:40:11 → 18:42:11 = exatamente 120s). Antes, ficava preso indefinidamente.

O problema agora é que o `Connect-ExchangeOnline` (ou o `Import-Module`) está falhando/travando, e **não temos visibilidade** do que o PowerShell está dizendo porque o output capturado durante a conexão é descartado quando o timeout ocorre.

```text
_read_until_marker() → timeout → retorna None
                                    ↑
                            As linhas lidas ficam perdidas
                            dentro da variável local `lines`
```

## Correção: Capturar e logar o output da fase de conexão

**Arquivo**: `python-agent/agent/executors/powershell.py`

### 1. Alterar `_read_until_marker` para retornar output mesmo em timeout

Em vez de retornar `None` no timeout, retornar uma tupla `(found: bool, output: str)`:

```python
def _read_until_marker(self, read_queue, marker, timeout):
    lines = []
    deadline = time.time() + timeout
    while True:
        remaining = deadline - time.time()
        if remaining <= 0:
            return (False, "\n".join(lines))  # Timeout, mas retorna o que leu
        try:
            line = read_queue.get(timeout=remaining)
        except queue.Empty:
            return (False, "\n".join(lines))  # Timeout
        if line is None:
            return (False, "\n".join(lines))  # EOF
        stripped = line.strip()
        if stripped == marker:
            return (True, "\n".join(lines))   # Found marker
        lines.append(stripped)
```

### 2. Atualizar todos os chamadores de `_read_until_marker`

**Conexão (linha 450)**: Logar o output capturado para diagnóstico

```python
found, output = self._read_until_marker(read_queue, self.SESSION_READY_MARKER, timeout=120)
if not found:
    error = "PowerShell session failed to connect within 120s"
    if output:
        self.logger.error(f"PowerShell output during connection:\n{output[:2000]}")
    ...
```

**Execução de comandos**: Ajustar para a tupla — `_read_until_marker` retorna `(found, output)` em vez de `str | None`.

**`_drain_and_sync`**: Ajustar chamada para usar tupla.

### 3. Impacto

- Zero mudança no fluxo — apenas expõe o que o PowerShell está dizendo durante a conexão
- Na próxima execução que falhar, o log vai mostrar exatamente o erro (módulo não encontrado, certificado inválido, network timeout, etc.)
- Permite diagnóstico remoto sem precisar conectar no servidor

### Resumo das mudanças

| Local | Mudança |
|-------|---------|
| `_read_until_marker` | Retorna `(bool, str)` em vez de `Optional[str]` |
| Conexão (linha 450) | Loga output capturado em caso de falha |
| Execução de comandos | Ajusta para tupla |
| `_drain_and_sync` | Ajusta para tupla |

