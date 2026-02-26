

## Correção: Python 3.9 incompatível com `str | None`

O erro é exatamente o que diagnosticamos. Python 3.9 não suporta PEP 604 (`str | None`). Precisa ser `Optional[str]`.

### Arquivos a corrigir

| Arquivo | Linha | De | Para |
|---------|-------|----|------|
| `python-agent/supervisor/heartbeat.py` | 27 | `str \| None` | `Optional[str]` |
| `python-agent/supervisor/main.py` | 52 | `str \| None` | `Optional[str]` |

### Mudanças específicas

**`python-agent/supervisor/heartbeat.py`**
- Adicionar `from typing import Optional` no topo
- Linha 27: `def tick(self, agent_version: Optional[str] = None) -> dict:`

**`python-agent/supervisor/main.py`**
- Adicionar `from typing import Optional` no topo
- Linha 52: `def _read_worker_version_from_disk() -> Optional[str]:`

### Após deploy

Rodar `--update` novamente. O Supervisor vai carregar sem `TypeError` e `supervisor.log` será criado.

