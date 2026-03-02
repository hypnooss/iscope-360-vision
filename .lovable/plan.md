

## Diagnóstico: Deadlock no pipe stderr

**Linha 420**: `stderr=subprocess.PIPE` — cria um pipe separado para stderr que **ninguém lê**.

```text
PowerShell (Connect-ExchangeOnline)
  │
  ├─ stdout: esperando para escrever SESSION_READY_MARKER
  └─ stderr: BLOQUEADO (buffer 64KB cheio com mensagens verbose/warning)
       │
       └─ Processo inteiro trava aqui → stdout nunca recebe o marker
                                       → queue.get(timeout=120) expira
                                       → ou fica preso para sempre (v1.3.5 sem queue)
```

## Correção: `python-agent/agent/executors/powershell.py`

### 1. Linha 420 — Redirecionar stderr para stdout

```python
# ANTES:
stderr=subprocess.PIPE,

# DEPOIS:
stderr=subprocess.STDOUT,
```

Isso mescla stderr no mesmo stream que stdout. A reader thread já drena tudo via queue, então o buffer nunca enche.

### 2. Linhas 455-462 — Remover leitura de proc.stderr no bloco de timeout

O bloco atual tenta ler `proc.stderr` após matar o processo. Com `stderr=subprocess.STDOUT`, não existe mais `proc.stderr` como pipe separado. Substituir por:

```python
if ready_output is None:
    error = "PowerShell session failed to connect within 120s"
    try:
        proc.kill()
        proc.communicate(timeout=5)
    except Exception:
        pass
    self.logger.error(error)
    return self._fail_all_steps(steps, error, report_callback)
```

(Remove as variáveis `stderr_output` e a tentativa de ler `proc.stderr`.)

### Impacto

- A reader thread (queue) já processa todas as linhas — as de stderr agora aparecem misturadas mas são ignoradas (não são markers)
- O `Connect-ExchangeOnline` não bloqueia mais ao escrever warnings
- O timeout de 120s funciona corretamente via `queue.get(timeout=120)`
- O método `run()` (batch) não é afetado — usa `subprocess.run(capture_output=True)` que gerencia os pipes automaticamente

