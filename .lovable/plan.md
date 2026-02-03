

## Correção de Conectividade IPv6 no SubdomainEnumExecutor

### Problema Identificado

O servidor está tentando conectar via **IPv6 primeiro** e falhando:

```
Trying 2a0e:ac00:c7:d449::5bc7:d449:443...
Immediate connect fail for 2a0e:ac00:c7:d449::5bc7:d449: Network is unreachable
```

O Python `requests` segue o comportamento padrão do sistema, tentando IPv6 antes de IPv4.

### Solução: Forçar IPv4 nas Requisições

Usar um `requests.adapters.HTTPAdapter` customizado que força a família de endereços para **AF_INET** (IPv4 only).

### Alterações no Arquivo

**Arquivo:** `python-agent/agent/executors/subdomain_enum.py`

**1. Adicionar imports necessários:**

```python
import socket
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.connection import allowed_gai_family
from typing import Any, Dict, List, Set
from .base import BaseExecutor
```

**2. Criar adapter IPv4-only:**

```python
class IPv4HTTPAdapter(HTTPAdapter):
    """Force IPv4 connections only."""
    def init_poolmanager(self, *args, **kwargs):
        import urllib3.util.connection as urllib3_conn
        # Monkey-patch temporário para forçar IPv4
        original_allowed_gai_family = urllib3_conn.allowed_gai_family
        urllib3_conn.allowed_gai_family = lambda: socket.AF_INET
        try:
            super().init_poolmanager(*args, **kwargs)
        finally:
            urllib3_conn.allowed_gai_family = original_allowed_gai_family
```

**3. Criar sessão com adapter IPv4:**

```python
def _get_session(self) -> requests.Session:
    """Create a requests session that forces IPv4."""
    session = requests.Session()
    adapter = IPv4HTTPAdapter()
    session.mount('https://', adapter)
    session.mount('http://', adapter)
    return session
```

**4. Atualizar métodos de query para usar a sessão:**

```python
def _query_crtsh(self, domain: str, timeout: int) -> Set[str]:
    """Query crt.sh Certificate Transparency logs."""
    url = f"https://crt.sh/?q=%25.{domain}&output=json"
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

    session = self._get_session()
    response = session.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    # ... resto do código
```

### Código Completo Atualizado

```python
"""
Subdomain Enumeration Executor - Multi-source subdomain discovery.
Uses free APIs: crt.sh, HackerTarget, AlienVault OTX.
Forces IPv4 to avoid IPv6 connectivity issues.
"""

import socket
import requests
from requests.adapters import HTTPAdapter
from typing import Any, Dict, List, Set
from .base import BaseExecutor


class IPv4HTTPAdapter(HTTPAdapter):
    """Force IPv4 connections only."""
    def init_poolmanager(self, *args, **kwargs):
        import urllib3.util.connection as urllib3_conn
        original_gai_family = urllib3_conn.allowed_gai_family
        urllib3_conn.allowed_gai_family = lambda: socket.AF_INET
        try:
            super().init_poolmanager(*args, **kwargs)
        finally:
            urllib3_conn.allowed_gai_family = original_gai_family


class SubdomainEnumExecutor(BaseExecutor):
    """Executor for subdomain enumeration using multiple free APIs."""

    DEFAULT_TIMEOUT = 30

    def _get_session(self) -> requests.Session:
        """Create a requests session that forces IPv4."""
        session = requests.Session()
        adapter = IPv4HTTPAdapter()
        session.mount('https://', adapter)
        session.mount('http://', adapter)
        return session

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        # ... mesmo código atual ...
        pass

    def _query_crtsh(self, domain: str, timeout: int) -> Set[str]:
        """Query crt.sh Certificate Transparency logs."""
        url = f"https://crt.sh/?q=%25.{domain}&output=json"
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

        session = self._get_session()
        response = session.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()

        subdomains = set()
        data = response.json()

        for cert in data:
            name_value = cert.get('name_value', '')
            for name in name_value.split('\n'):
                name = name.strip().lower().lstrip('*.')
                if self._is_valid_subdomain(name, domain):
                    subdomains.add(name)

        return subdomains

    def _query_hackertarget(self, domain: str, timeout: int) -> Set[str]:
        """Query HackerTarget API."""
        url = f"https://api.hackertarget.com/hostsearch/?q={domain}"

        session = self._get_session()
        response = session.get(url, timeout=timeout)
        response.raise_for_status()

        subdomains = set()
        for line in response.text.strip().split('\n'):
            if ',' in line:
                subdomain = line.split(',')[0].strip().lower()
                if self._is_valid_subdomain(subdomain, domain):
                    subdomains.add(subdomain)

        return subdomains

    def _query_alienvault(self, domain: str, timeout: int) -> Set[str]:
        """Query AlienVault OTX passive DNS."""
        url = f"https://otx.alienvault.com/api/v1/indicators/domain/{domain}/passive_dns"
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

        session = self._get_session()
        response = session.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()

        subdomains = set()
        data = response.json()

        for record in data.get('passive_dns', []):
            hostname = record.get('hostname', '').strip().lower()
            if self._is_valid_subdomain(hostname, domain):
                subdomains.add(hostname)

        return subdomains

    def _is_valid_subdomain(self, name: str, base_domain: str) -> bool:
        # ... mesmo código ...
        pass
```

### Deploy

1. Copiar o arquivo atualizado para o servidor
2. Limpar cache: `rm -rf /opt/iscope-agent/agent/__pycache__ /opt/iscope-agent/agent/executors/__pycache__`
3. Reiniciar: `systemctl restart iscope-agent`
4. Disparar nova análise de External Domain

### Teste Manual (validar antes do deploy)

```bash
# Forçar IPv4 com curl
curl -4 "https://crt.sh/?q=%25.google.com&output=json" --max-time 30 | head -c 500
```

Se funcionar com `-4`, a correção no Python resolverá o problema.

