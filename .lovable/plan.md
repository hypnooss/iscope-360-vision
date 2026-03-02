

## Problema Identificado: `readline()` bloqueante ignora o timeout

O método `_read_until_marker` (linha 278) usa `stdout.readline()` que é **bloqueante**. O `threading.Timer` marca o evento `timed_out`, mas o loop só verifica `timed_out.is_set()` **após** `readline()` retornar. Se o PowerShell não escreve nada no stdout (ex: o `Connect-ExchangeOnline` demora ou trava), o `readline()` fica bloqueado para sempre e o timeout nunca atua.

```text
while not timed_out.is_set():      # ✅ Verifica timeout
    line = stdout.readline()        # ❌ BLOQUEIA aqui indefinidamente
    ...                             # Nunca chega aqui se não houver output
```

É por isso que o agente fica preso em "Waiting for PowerShell session to connect..." mesmo com timeout de 120s.

## Solução: Leitura em thread separada com queue

Mover a leitura de `stdout.readline()` para uma thread dedicada que alimenta uma `queue.Queue`. O loop principal faz `queue.get(timeout=...)`, que respeita o timeout corretamente.

### Mudança em `python-agent/agent/executors/powershell.py`

**1. Adicionar import** de `queue` (linha 7).

**2. Adicionar método `_start_reader_thread`**: cria uma thread daemon que faz `readline()` em loop e coloca cada linha na queue. Quando stdout fecha (EOF), coloca um sentinel `None`.

```python
def _start_reader_thread(self, stdout) -> queue.Queue:
    q = queue.Queue()
    def _reader():
        try:
            for line in iter(stdout.readline, ''):
                q.put(line)
        except Exception:
            pass
        q.put(None)  # EOF sentinel
    t = threading.Thread(target=_reader, daemon=True)
    t.start()
    return q
```

**3. Reescrever `_read_until_marker`**: usar `q.get(timeout=remaining)` em vez de `stdout.readline()`. Calcula o tempo restante a cada iteração.

```python
def _read_until_marker(self, read_queue, marker, timeout):
    lines = []
    deadline = time.time() + timeout
    while True:
        remaining = deadline - time.time()
        if remaining <= 0:
            return None  # Timeout
        try:
            line = read_queue.get(timeout=remaining)
        except queue.Empty:
            return None  # Timeout
        if line is None:
            return "\n".join(lines) if lines else None  # EOF
        stripped = line.strip()
        if stripped == marker:
            return "\n".join(lines)
        lines.append(stripped)
```

**4. Atualizar `run_interactive`**: criar a queue logo após o `Popen`, e passar `read_queue` em vez de `proc.stdout` para todas as chamadas de `_read_until_marker` e `_drain_and_sync`.

**5. Atualizar `_drain_and_sync`**: receber `read_queue` em vez de `proc` para a leitura.

### Impacto

- O método `run()` (batch) não é afetado - continua usando `subprocess.run`
- A queue é thread-safe e funciona tanto no Linux quanto no Windows
- O timeout agora funciona de verdade - `queue.get(timeout=X)` levanta `Empty` após X segundos

