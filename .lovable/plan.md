

## Plano: Timeout com extensão por atividade

### Problema
O `_read_until_marker` em `powershell.py` usa um deadline fixo. Se um cmdlet produz output contínuo (como centenas de warnings do `Get-InboxRule`), esse output consome o timeout sem resetá-lo, causando falso timeout mesmo com o processo ativo.

### Solução
Modificar `_read_until_marker` para **resetar o deadline a cada linha recebida**, com um cap máximo absoluto.

### Mudança em `python-agent/agent/executors/powershell.py`

**Método `_read_until_marker` (linhas 325-349):**

Adicionar parâmetro `max_timeout` (padrão 600s = 10 min) como limite absoluto. A cada linha recebida da queue, resetar o deadline para `now + timeout`, desde que não ultrapasse o limite absoluto.

```python
def _read_until_marker(self, read_queue, marker, timeout, max_timeout=600):
    lines = []
    start = time.time()
    abs_deadline = start + max_timeout  # Cap absoluto de 10 min
    deadline = start + timeout          # Deadline dinâmico

    while True:
        remaining = min(deadline, abs_deadline) - time.time()
        if remaining <= 0:
            return (False, "\n".join(lines))
        try:
            line = read_queue.get(timeout=remaining)
        except queue.Empty:
            return (False, "\n".join(lines))
        if line is None:
            return (False, "\n".join(lines))
        line_clean = self._sanitize_line(line)
        if marker in line_clean or line_clean == marker:
            return (True, "\n".join(lines))
        lines.append(line_clean)
        # Reset deadline on activity (output received = process is alive)
        deadline = time.time() + timeout
```

Isso resolve o `exo_inbox_rules`: enquanto warnings estão fluindo, o timeout se renova. Só expira se houver **silêncio real** por `timeout` segundos (120s por padrão). O cap absoluto de 10 min previne loops infinitos.

### Arquivo modificado
- `python-agent/agent/executors/powershell.py` — método `_read_until_marker`

