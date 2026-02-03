

# Plano: Integrar Amass ao Python Agent

## Visão Geral

Adicionar o Amass (ferramenta de enumeração de subdomínios em Go) ao Python Agent, incluindo instalação automática via script de instalação e um novo executor para processar os resultados.

---

## Arquitetura

```text
┌────────────────────────────────────────────────────────────────────┐
│                    Script de Instalação (Bash)                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  install_amass() - Nova função                               │  │
│  │  - Detecta arquitetura (amd64/arm64)                         │  │
│  │  - Baixa release do GitHub                                   │  │
│  │  - Extrai binário para /usr/local/bin/amass                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                     Python Agent (Executor)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  AmassExecutor - python-agent/agent/executors/amass.py       │  │
│  │  - Executa: amass enum -passive -d domain -json /tmp/out     │  │
│  │  - Lê e parseia arquivo JSON de saída                        │  │
│  │  - Retorna lista de subdomínios + metadados                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Fase 1: Atualizar Script de Instalação

### Arquivo: `supabase/functions/agent-install/index.ts`

**Alterações:**

1. Adicionar função `install_amass()` que:
   - Detecta arquitetura do sistema (amd64 ou arm64)
   - Baixa o binário pré-compilado do GitHub Releases
   - Extrai e instala em `/usr/local/bin/amass`
   - Verifica instalação com `amass -version`

2. Chamar `install_amass` após `install_deps` no fluxo principal

**Nova função a adicionar (~linhas 187-220):**

```bash
install_amass() {
  echo "Instalando Amass para enumeração de subdomínios..."
  
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64)  arch="amd64" ;;
    aarch64) arch="arm64" ;;
    *)
      echo "Aviso: arquitetura $arch não suportada para Amass. Pulando instalação."
      return 0
      ;;
  esac
  
  local version="v4.2.0"
  local filename="amass_Linux_${arch}.zip"
  local url="https://github.com/owasp-amass/amass/releases/download/${version}/${filename}"
  local tmp_dir
  tmp_dir="$(mktemp -d)"
  
  echo "Baixando Amass ${version} (${arch})..."
  
  if ! curl -fsSL "$url" -o "${tmp_dir}/amass.zip"; then
    echo "Aviso: falha ao baixar Amass. Continuando sem ele."
    rm -rf "$tmp_dir"
    return 0
  fi
  
  # Instalar unzip se necessário
  if ! command -v unzip >/dev/null 2>&1; then
    if command -v apt-get >/dev/null 2>&1; then
      apt-get install -y unzip || true
    elif command -v dnf >/dev/null 2>&1; then
      dnf install -y unzip || true
    elif command -v yum >/dev/null 2>&1; then
      yum install -y unzip || true
    fi
  fi
  
  unzip -q "${tmp_dir}/amass.zip" -d "$tmp_dir"
  
  # O zip contém uma pasta amass_Linux_xxx/amass
  local bin_path
  bin_path="$(find "$tmp_dir" -name 'amass' -type f -executable | head -1)"
  
  if [[ -n "$bin_path" ]]; then
    mv "$bin_path" /usr/local/bin/amass
    chmod +x /usr/local/bin/amass
    echo "Amass instalado: $(amass -version 2>&1 | head -1)"
  else
    echo "Aviso: binário do Amass não encontrado no pacote."
  fi
  
  rm -rf "$tmp_dir"
}
```

**Atualização da função main (~linha 383):**

```bash
main() {
  # ... existing code ...
  
  install_deps
  install_amass    # <-- NOVA LINHA
  ensure_user
  # ... rest of function ...
}
```

---

## Fase 2: Criar Executor Amass

### Novo Arquivo: `python-agent/agent/executors/amass.py`

```python
"""
Amass Executor - Subdomain enumeration using OWASP Amass.

Executes Amass in passive or active mode and returns discovered subdomains
with source information.
"""

import json
import os
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

from .base import BaseExecutor


class AmassExecutor(BaseExecutor):
    """Executor for subdomain enumeration using Amass."""

    DEFAULT_TIMEOUT = 300  # 5 minutes default
    MAX_TIMEOUT = 900      # 15 minutes max

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Amass enumeration.

        Config options:
            domain: Target domain (required, can come from context)
            mode: 'passive' (default) or 'active'
            timeout: Max execution time in seconds (default: 300)
            max_depth: DNS brute force recursion depth (active mode only)
            config_file: Path to custom Amass config.yaml (optional)

        Returns:
            Dict with:
                - domain: Target domain
                - subdomains: List of discovered subdomains with metadata
                - total_found: Number of unique subdomains
                - sources: List of data sources used
                - mode: Enumeration mode used
        """
        config = step.get('config', {}) or {}
        step_id = step.get('id', 'unknown')

        domain = (config.get('domain') or context.get('domain') or '').strip().rstrip('.')
        mode = config.get('mode', 'passive').lower()
        timeout = min(config.get('timeout', self.DEFAULT_TIMEOUT), self.MAX_TIMEOUT)
        max_depth = config.get('max_depth', 1)

        if not domain:
            return {'status_code': 0, 'data': None, 'error': 'Missing domain'}

        # Check if Amass is installed
        amass_path = shutil.which('amass')
        if not amass_path:
            self.logger.error(f"Step {step_id}: Amass not installed")
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': 'Amass not installed. Run agent installer with --update.'
            }

        self.logger.info(f"Step {step_id}: Running Amass ({mode}) for {domain}")

        # Create temp file for JSON output
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            output_file = f.name

        try:
            # Build command
            cmd = [
                amass_path,
                'enum',
                '-d', domain,
                '-json', output_file,
                '-timeout', str(int(timeout / 60)),  # Amass uses minutes
            ]

            if mode == 'passive':
                cmd.append('-passive')
            elif mode == 'active':
                cmd.extend(['-active', '-brute'])
                if max_depth > 1:
                    cmd.extend(['-max-depth', str(max_depth)])

            # Execute Amass
            self.logger.debug(f"Step {step_id}: Executing: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 30,  # Extra buffer
                cwd='/tmp'
            )

            if result.returncode != 0 and not os.path.exists(output_file):
                error_msg = result.stderr[:500] if result.stderr else f"Exit code: {result.returncode}"
                self.logger.error(f"Step {step_id}: Amass failed - {error_msg}")
                return {
                    'status_code': result.returncode,
                    'data': {'domain': domain, 'subdomains': []},
                    'error': f"Amass failed: {error_msg}"
                }

            # Parse JSON output (one JSON object per line)
            subdomains = []
            sources_set = set()

            if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                with open(output_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entry = json.loads(line)
                            name = entry.get('name', '').lower()
                            if name and self._is_valid_subdomain(name, domain):
                                subdomain_entry = {
                                    'subdomain': name,
                                    'sources': entry.get('sources', []),
                                    'addresses': entry.get('addresses', []),
                                }
                                subdomains.append(subdomain_entry)
                                for src in entry.get('sources', []):
                                    sources_set.add(src)
                        except json.JSONDecodeError:
                            continue

            # Deduplicate by subdomain name
            seen = set()
            unique_subdomains = []
            for sub in subdomains:
                if sub['subdomain'] not in seen:
                    seen.add(sub['subdomain'])
                    unique_subdomains.append(sub)

            # Sort alphabetically
            unique_subdomains.sort(key=lambda x: x['subdomain'])

            self.logger.info(
                f"Step {step_id}: Amass found {len(unique_subdomains)} unique subdomains "
                f"from {len(sources_set)} sources"
            )

            return {
                'status_code': 200,
                'data': {
                    'domain': domain,
                    'mode': mode,
                    'total_found': len(unique_subdomains),
                    'sources': sorted(list(sources_set)),
                    'subdomains': unique_subdomains,
                },
                'error': None,
            }

        except subprocess.TimeoutExpired:
            self.logger.error(f"Step {step_id}: Amass timeout after {timeout}s")
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

        finally:
            # Cleanup temp file
            if os.path.exists(output_file):
                os.remove(output_file)

    def _is_valid_subdomain(self, name: str, base_domain: str) -> bool:
        """Check if name is a valid subdomain of base_domain."""
        name = name.lstrip('*.').lower()
        base_domain = base_domain.lower()
        if not name:
            return False
        return name == base_domain or name.endswith(f".{base_domain}")
```

---

## Fase 3: Registrar Executor

### Arquivo: `python-agent/agent/executors/__init__.py`

Adicionar import e export:

```python
from agent.executors.base import BaseExecutor
from agent.executors.http_request import HTTPRequestExecutor
from agent.executors.ssh import SSHExecutor
from agent.executors.snmp import SNMPExecutor
from agent.executors.dns_query import DNSQueryExecutor
from agent.executors.amass import AmassExecutor  # NOVO

__all__ = [
    'BaseExecutor',
    'HTTPRequestExecutor',
    'SSHExecutor',
    'SNMPExecutor',
    'DNSQueryExecutor',
    'AmassExecutor',  # NOVO
]
```

### Arquivo: `python-agent/agent/tasks.py`

Adicionar executor ao registro (linha ~14 e ~45):

```python
from agent.executors.amass import AmassExecutor

# Na classe TaskExecutor.__init__:
self._executors = {
    'http_request': HTTPRequestExecutor(logger),
    'http_session': HTTPSessionExecutor(logger),
    'ssh_command': SSHExecutor(logger),
    'snmp_query': SNMPExecutor(logger),
    'dns_query': DNSQueryExecutor(logger),
    'amass': AmassExecutor(logger),  # NOVO
}
```

---

## Fase 4: Exemplo de Blueprint Step

Para usar o Amass no blueprint de external_domain, adicionar um step como:

```json
{
  "id": "subdomain_enum",
  "type": "amass",
  "config": {
    "mode": "passive",
    "timeout": 300
  }
}
```

---

## Resumo de Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/agent-install/index.ts` | Editar | Adicionar função `install_amass()` |
| `python-agent/agent/executors/amass.py` | Criar | Novo executor Amass |
| `python-agent/agent/executors/__init__.py` | Editar | Registrar AmassExecutor |
| `python-agent/agent/tasks.py` | Editar | Adicionar amass ao mapa de executors |

---

## Fontes de Dados do Amass (modo passive)

O Amass consulta automaticamente 50+ fontes gratuitas:

| Categoria | Fontes |
|-----------|--------|
| Certificate Transparency | crt.sh, Censys, CertSpotter, Facebook CT |
| DNS Passivo | VirusTotal, SecurityTrails, RiskIQ, Robtex |
| Web Archives | Wayback Machine, CommonCrawl |
| Search Engines | Google, Bing, Yahoo, Baidu |
| Outros | DNSDumpster, ThreatCrowd, Shodan (com API key) |

---

## Modo Active vs Passive

| Modo | Comportamento | Tempo | Ruído |
|------|---------------|-------|-------|
| `passive` | Só consulta APIs externas | ~1-3 min | Zero (não toca o alvo) |
| `active` | Passive + brute-force + resolução | ~5-15 min | Gera queries DNS para o alvo |

**Recomendação:** Usar `passive` como padrão para não gerar tráfego suspeito no domínio alvo.

---

## Resultado Esperado

Após a implementação, o Agent poderá executar tasks com steps do tipo `amass`, retornando:

```json
{
  "domain": "example.com",
  "mode": "passive",
  "total_found": 47,
  "sources": ["crtsh", "virustotal", "wayback", "commoncrawl"],
  "subdomains": [
    {
      "subdomain": "api.example.com",
      "sources": ["crtsh", "virustotal"],
      "addresses": [{"ip": "1.2.3.4", "cidr": "1.2.3.0/24"}]
    },
    {
      "subdomain": "mail.example.com",
      "sources": ["wayback"],
      "addresses": []
    }
  ]
}
```

