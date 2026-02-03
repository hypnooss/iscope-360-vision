

# Plano: Atualizar AmassExecutor para Suportar Amass v4.x

## Problema Identificado

O Amass **v4.2.0** instalado no servidor removeu a flag `-json`:
```
flag provided but not defined: -json
```

O Amass v4.x mudou o formato de output - agora usa apenas stdout com formato de grafo textual.

---

## Solução

Atualizar o `AmassExecutor` para parsear a saída de texto (stdout) do Amass v4.x ao invés de depender de JSON.

### Formato de Saída do Amass v4.x

```text
subdomain.example.com (FQDN) --> a_record --> 192.168.1.1 (IPAddress)
subdomain.example.com (FQDN) --> cname_record --> target.cdn.com (FQDN)
example.com (FQDN) --> ns_record --> ns1.dns.com (FQDN)
```

---

## Alterações no Arquivo

**Arquivo:** `python-agent/agent/executors/amass.py`

### 1. Remover flag `-json`

De:
```python
cmd = [
    amass_path,
    'enum',
    '-d', domain,
    '-json', output_file,  # ❌ Não suportado no v4
    '-timeout', str(int(timeout / 60)),
]
```

Para:
```python
cmd = [
    amass_path,
    'enum',
    '-d', domain,
    '-timeout', str(int(timeout / 60)),
]
```

### 2. Parsear stdout ao invés de arquivo JSON

Adicionar método para extrair subdomínios da saída de texto:

```python
def _parse_amass_output(self, output: str, base_domain: str) -> tuple[list, set]:
    """
    Parse Amass v4.x text output format.
    
    Format: name (FQDN) --> record_type --> target (type)
    """
    subdomains = {}
    sources_set = set()
    
    for line in output.splitlines():
        line = line.strip()
        if not line or '-->' not in line:
            continue
        
        # Parse format: "subdomain.example.com (FQDN) --> a_record --> 1.2.3.4 (IPAddress)"
        parts = line.split(' --> ')
        if len(parts) >= 1:
            # Extract subdomain from first part
            match = re.match(r'^([^\s]+)\s*\(FQDN\)', parts[0])
            if match:
                name = match.group(1).lower()
                if self._is_valid_subdomain(name, base_domain):
                    if name not in subdomains:
                        subdomains[name] = {
                            'subdomain': name,
                            'sources': [],
                            'addresses': [],
                        }
                    
                    # Extract IP addresses from line
                    if len(parts) >= 3:
                        ip_match = re.search(r'([\d\.]+)\s*\(IPAddress\)', parts[-1])
                        if ip_match:
                            ip = ip_match.group(1)
                            if ip not in [a.get('ip') for a in subdomains[name]['addresses']]:
                                subdomains[name]['addresses'].append({'ip': ip, 'type': 'A'})
                        
                        ipv6_match = re.search(r'([a-fA-F0-9:]+)\s*\(IPAddress\)', parts[-1])
                        if ipv6_match and ':' in ipv6_match.group(1):
                            ip = ipv6_match.group(1)
                            if ip not in [a.get('ip') for a in subdomains[name]['addresses']]:
                                subdomains[name]['addresses'].append({'ip': ip, 'type': 'AAAA'})
        
        # Extract source from "Querying X for domain" lines
        if line.startswith('Querying '):
            source_match = re.match(r'Querying (\S+) for', line)
            if source_match:
                sources_set.add(source_match.group(1))
    
    return list(subdomains.values()), sources_set
```

### 3. Atualizar método `run()` para usar novo parser

```python
# Execute Amass
result = subprocess.run(
    cmd,
    capture_output=True,
    text=True,
    timeout=timeout + 30,
    cwd='/tmp'
)

# Parse text output (Amass v4.x format)
subdomains, sources_set = self._parse_amass_output(
    result.stdout + result.stderr,  # Amass pode usar stderr para output
    domain
)

# Sort and return
subdomains.sort(key=lambda x: x['subdomain'])
```

---

## Código Completo Atualizado

```python
"""
Amass Executor - Subdomain enumeration using OWASP Amass.

Supports Amass v4.x text output format.
"""

import os
import re
import shutil
import subprocess
from typing import Any, Dict, List, Set, Tuple

from .base import BaseExecutor


class AmassExecutor(BaseExecutor):
    """Executor for subdomain enumeration using Amass."""

    DEFAULT_TIMEOUT = 300  # 5 minutes default
    MAX_TIMEOUT = 900      # 15 minutes max

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        config = step.get('config', {}) or {}
        step_id = step.get('id', 'unknown')

        domain = (config.get('domain') or context.get('domain') or '').strip().rstrip('.')
        mode = config.get('mode', 'passive').lower()
        timeout = min(config.get('timeout', self.DEFAULT_TIMEOUT), self.MAX_TIMEOUT)
        max_depth = config.get('max_depth', 1)

        if not domain:
            return {'status_code': 0, 'data': None, 'error': 'Missing domain'}

        amass_path = shutil.which('amass')
        if not amass_path:
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': 'Amass not installed.'
            }

        self.logger.info(f"Step {step_id}: Running Amass ({mode}) for {domain}")

        try:
            # Build command (Amass v4.x - no JSON flag)
            cmd = [
                amass_path,
                'enum',
                '-d', domain,
                '-timeout', str(int(timeout / 60)),
            ]

            if mode == 'passive':
                cmd.append('-passive')
            elif mode == 'active':
                cmd.extend(['-active', '-brute'])
                if max_depth > 1:
                    cmd.extend(['-max-depth', str(max_depth)])

            self.logger.debug(f"Step {step_id}: Executing: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 30,
                cwd='/tmp'
            )

            # Parse text output (Amass v4.x format)
            combined_output = (result.stdout or '') + '\n' + (result.stderr or '')
            subdomains, sources_set = self._parse_amass_output(combined_output, domain)

            # Sort alphabetically
            subdomains.sort(key=lambda x: x['subdomain'])

            self.logger.info(
                f"Step {step_id}: Amass found {len(subdomains)} unique subdomains "
                f"from {len(sources_set)} sources"
            )

            return {
                'status_code': 200,
                'data': {
                    'domain': domain,
                    'mode': mode,
                    'total_found': len(subdomains),
                    'sources': sorted(list(sources_set)),
                    'subdomains': subdomains,
                },
                'error': None,
            }

        except subprocess.TimeoutExpired:
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': f'Amass timeout after {timeout} seconds'
            }

        except Exception as e:
            self.logger.error(f"Step {step_id}: Amass error - {str(e)}")
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': str(e),
            }

    def _parse_amass_output(self, output: str, base_domain: str) -> Tuple[List[Dict], Set[str]]:
        """Parse Amass v4.x text output format."""
        subdomains: Dict[str, Dict] = {}
        sources_set: Set[str] = set()
        
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            
            # Extract sources from "Querying X for domain" lines
            if line.startswith('Querying '):
                source_match = re.match(r'Querying (\S+) for', line)
                if source_match:
                    sources_set.add(source_match.group(1))
                continue
            
            # Parse format: "name (FQDN) --> record_type --> target (type)"
            if ' --> ' not in line:
                continue
                
            parts = line.split(' --> ')
            if len(parts) < 1:
                continue
            
            # Extract subdomain from first part
            match = re.match(r'^([^\s]+)\s*\(FQDN\)', parts[0])
            if not match:
                continue
                
            name = match.group(1).lower()
            if not self._is_valid_subdomain(name, base_domain):
                continue
            
            if name not in subdomains:
                subdomains[name] = {
                    'subdomain': name,
                    'sources': [],
                    'addresses': [],
                }
            
            # Extract IP addresses from last part
            if len(parts) >= 3:
                last_part = parts[-1]
                
                # IPv4 address
                ipv4_match = re.search(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*\(IPAddress\)', last_part)
                if ipv4_match:
                    ip = ipv4_match.group(1)
                    existing_ips = [a.get('ip') for a in subdomains[name]['addresses']]
                    if ip not in existing_ips:
                        subdomains[name]['addresses'].append({'ip': ip, 'type': 'A'})
                
                # IPv6 address
                ipv6_match = re.search(r'([a-fA-F0-9:]+)\s*\(IPAddress\)', last_part)
                if ipv6_match and ':' in ipv6_match.group(1):
                    ip = ipv6_match.group(1)
                    existing_ips = [a.get('ip') for a in subdomains[name]['addresses']]
                    if ip not in existing_ips:
                        subdomains[name]['addresses'].append({'ip': ip, 'type': 'AAAA'})
        
        return list(subdomains.values()), sources_set

    def _is_valid_subdomain(self, name: str, base_domain: str) -> bool:
        """Check if name is a valid subdomain of base_domain."""
        name = name.lstrip('*.').lower()
        base_domain = base_domain.lower()
        if not name:
            return False
        return name == base_domain or name.endswith(f".{base_domain}")
```

---

## Resumo das Alterações

| Antes (v3.x) | Depois (v4.x) |
|--------------|---------------|
| `-json output.json` | Removido |
| Parse arquivo JSON | Parse stdout texto |
| Depende de arquivo temp | Sem arquivo temporário |

---

## Próximos Passos Após Deploy

1. Atualizar o Agent no servidor (pull do código ou reinstalar)
2. Reiniciar o serviço: `systemctl restart iscope-agent`
3. Executar nova análise de domínio externo
4. Verificar se subdomínios aparecem no relatório

---

## Considerações Técnicas

- O novo parser extrai FQDNs e endereços IP do formato de grafo do Amass v4
- As fontes são extraídas das linhas "Querying X for domain"
- Compatível com modos passive e active
- Sem dependência de arquivos temporários

