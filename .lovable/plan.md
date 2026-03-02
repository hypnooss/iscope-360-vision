

## Problema: Timeout de um comando corrompe a sessão stdout

A implementação atual faz `continue` após timeout (linha 509), mas há um problema crítico: quando o comando 15 dá timeout, o PowerShell **ainda está processando** esse comando. A saída dele (markers `CMD_START`/`CMD_END`) vai eventualmente aparecer no stdout, **misturando-se com a saída do comando 16**. Isso causa falha em cascata de todos os comandos subsequentes.

### Solução: Sincronização pós-timeout

Após cada timeout, enviar um comando de **sincronização** ao PowerShell que produz um marker único, e drenar todo o stdout até esse marker. Isso garante que qualquer saída residual do comando anterior seja descartada antes de enviar o próximo.

### Mudança em `python-agent/agent/executors/powershell.py`

**1. Adicionar marker de sincronização** (constante):
```python
SYNC_MARKER = "---ISCOPE_SYNC---"
```

**2. Adicionar método `_drain_and_sync`**:
```python
def _drain_and_sync(self, proc, timeout=30):
    """After a timeout, send a sync marker and drain stdout until it appears."""
    try:
        sync_cmd = f'Write-Output "{self.SYNC_MARKER}"\n'
        proc.stdin.write(sync_cmd)
        proc.stdin.flush()
        self._read_until_marker(proc.stdout, self.SYNC_MARKER, timeout=timeout)
    except Exception as e:
        self.logger.warning(f"Sync after timeout failed: {e}")
```

**3. Chamar `_drain_and_sync` após cada timeout** (linhas 496 e 522, antes do `continue`):
```python
# After timeout handling, before continue:
self._drain_and_sync(proc)
```

Isso garante que mesmo que o comando 15 produza saída tardia, ela é descartada, e o comando 16 começa com o stdout limpo.

