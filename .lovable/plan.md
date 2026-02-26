

## Problema

Claro como agua. Vou resumir para confirmar:

1. **O Supervisor e o Agent compartilham o mesmo logger** — ambos chamam `setup_logger()` que usa `logging.getLogger("infrascope360")` e escreve no mesmo `AGENT_LOG_FILE`. Resultado: logs misturados num arquivo so.

2. **O Supervisor usa `from agent.logger import setup_logger`** — nao tem logger proprio. Ambos os processos escrevem em `/var/log/iscope-agent/agent.log`.

3. **Os unit files usam `StandardOutput=journal`** — no journald ja estao separados via `SyslogIdentifier` (`iscope-supervisor` vs `iscope-agent`). Mas o arquivo de log em disco (`/var/log/iscope-agent/agent.log`) mistura tudo porque ambos usam a mesma env var `AGENT_LOG_FILE`.

## Plano

### 1. Criar logger separado para o Supervisor

**Arquivo:** `python-agent/supervisor/logger.py` (novo)

```python
import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_supervisor_logger():
    """Logger dedicado do Supervisor. Arquivo via SUPERVISOR_LOG_FILE."""

    logger = logging.getLogger("iscope-supervisor")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    if not logger.handlers:
        stream_handler = logging.StreamHandler(sys.stdout)
        stream_handler.setFormatter(formatter)
        logger.addHandler(stream_handler)

        log_file = os.getenv("SUPERVISOR_LOG_FILE")
        if log_file:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            file_handler = RotatingFileHandler(
                str(log_path),
                maxBytes=1 * 1024 * 1024,
                backupCount=1,
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

    return logger
```

### 2. Usar o logger dedicado no Supervisor

**Arquivo:** `python-agent/supervisor/main.py`

Trocar:
```python
from agent.logger import setup_logger
```
Por:
```python
from supervisor.logger import setup_supervisor_logger
```

E na funcao `main()`:
```python
logger = setup_supervisor_logger()
```

### 3. Adicionar `SUPERVISOR_LOG_FILE` no env

**Arquivo:** `supabase/functions/agent-install/index.ts`, funcao `write_env_file()`

Adicionar na geracao do env file:
```
SUPERVISOR_LOG_FILE=/var/log/iscope-agent/supervisor.log
```

E no bloco de update (append se ausente):
```bash
grep -q "^SUPERVISOR_LOG_FILE=" "$env_file" || \
  echo "SUPERVISOR_LOG_FILE=/var/log/iscope-agent/supervisor.log" >> "$env_file"
```

**Arquivo:** `supabase/functions/super-agent-install/index.ts` — mesma mudanca.

### 4. Criar diretorio de logs no `ensure_dirs()`

Ja existe: `mkdir -p "/var/log/iscope-agent"`. Os dois arquivos (`agent.log` e `supervisor.log`) ficam no mesmo diretorio mas em arquivos separados.

### Resultado

```text
/var/log/iscope-agent/
├── agent.log        ← logs do Worker (main.py) — AGENT_LOG_FILE
└── supervisor.log   ← logs do Supervisor       — SUPERVISOR_LOG_FILE
```

No journald, ja separados via `SyslogIdentifier`:
```bash
journalctl -u iscope-agent -f       # Worker
journalctl -u iscope-supervisor -f  # Supervisor
```

### Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| `python-agent/supervisor/logger.py` | Novo: logger dedicado do Supervisor |
| `python-agent/supervisor/main.py` | Usar `setup_supervisor_logger()` em vez de `setup_logger()` |
| `supabase/functions/agent-install/index.ts` | Adicionar `SUPERVISOR_LOG_FILE` no env |
| `supabase/functions/super-agent-install/index.ts` | Mesma mudanca |

