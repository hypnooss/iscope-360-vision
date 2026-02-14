

# Fix: Compatibilidade Python no nmap_discovery.py

## Problema

O arquivo `nmap_discovery.py` usa a sintaxe `List[int] | None` (linha 61) que so funciona a partir do Python 3.10. O servidor do agent provavelmente roda Python 3.9 ou anterior, causando crash imediato no import.

## Correcao

Substituir `List[int] | None` por `Optional[List[int]]` (importando `Optional` de `typing`).

### Arquivo: `python-agent/agent/executors/nmap_discovery.py`

Linha 10 - adicionar `Optional` ao import:
```python
from typing import Dict, Any, List, Optional
```

Linha 61 - corrigir type hint:
```python
def _run_scan(
    self, ip: str, port_spec: str, max_rate: int, timeout: int, use_top_ports: bool = False
) -> Optional[List[int]]:
```

Apenas essas duas mudancas resolvem o crash. Nenhum outro arquivo precisa ser alterado.

