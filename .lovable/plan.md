

## Expansão do SubdomainEnumExecutor: Novas Fontes de APIs

### APIs Gratuitas para Adicionar

| API | URL Base | Limite | Qualidade |
|-----|----------|--------|-----------|
| **RapidDNS** | `rapiddns.io/subdomain/{domain}` | Ilimitado | Muito boa |
| **ThreatMiner** | `api.threatminer.org/v2/domain.php` | Ilimitado | Boa |
| **URLScan.io** | `urlscan.io/api/v1/search` | 100/dia | Excelente |
| **Wayback Machine** | `web.archive.org/cdx/search/cdx` | Ilimitado | Histórica |
| **CertSpotter** | `api.certspotter.com/v1/issuances` | 100/hora | Boa (CT logs) |
| **JLDC** | `jldc.me/anubis/subdomains/{domain}` | Ilimitado | Boa |

### Alterações no Arquivo

**Arquivo:** `python-agent/agent/executors/subdomain_enum.py`

### Novos Métodos a Adicionar

```python
def _query_rapiddns(self, domain: str, timeout: int) -> Set[str]:
    """Query RapidDNS.io for subdomains."""
    import re
    url = f"https://rapiddns.io/subdomain/{domain}?full=1"
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

    session = self._get_session()
    response = session.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    subdomains = set()
    # Parse HTML response - subdomains are in <td> tags
    pattern = r'<td>([a-zA-Z0-9.-]+\.' + re.escape(domain) + r')</td>'
    matches = re.findall(pattern, response.text, re.IGNORECASE)
    
    for match in matches:
        name = match.strip().lower()
        if self._is_valid_subdomain(name, domain):
            subdomains.add(name)

    return subdomains


def _query_threatminer(self, domain: str, timeout: int) -> Set[str]:
    """Query ThreatMiner API for subdomains."""
    url = f"https://api.threatminer.org/v2/domain.php?q={domain}&rt=5"
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

    session = self._get_session()
    response = session.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    subdomains = set()
    data = response.json()

    if data.get('status_code') == '200':
        for subdomain in data.get('results', []):
            name = subdomain.strip().lower()
            if self._is_valid_subdomain(name, domain):
                subdomains.add(name)

    return subdomains


def _query_urlscan(self, domain: str, timeout: int) -> Set[str]:
    """Query URLScan.io for subdomains (100 requests/day free)."""
    url = f"https://urlscan.io/api/v1/search/?q=domain:{domain}"
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

    session = self._get_session()
    response = session.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    subdomains = set()
    data = response.json()

    for result in data.get('results', []):
        task = result.get('task', {})
        page_domain = task.get('domain', '').strip().lower()
        if self._is_valid_subdomain(page_domain, domain):
            subdomains.add(page_domain)

    return subdomains


def _query_wayback(self, domain: str, timeout: int) -> Set[str]:
    """Query Wayback Machine CDX API for historical subdomains."""
    url = f"http://web.archive.org/cdx/search/cdx?url=*.{domain}/*&output=json&fl=original&collapse=urlkey"
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

    session = self._get_session()
    response = session.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    subdomains = set()
    data = response.json()

    # Skip header row
    for row in data[1:] if len(data) > 1 else []:
        if row:
            # Extract domain from URL
            url_str = row[0] if isinstance(row, list) else row
            # Parse: https://subdomain.domain.com/path -> subdomain.domain.com
            import re
            match = re.search(r'https?://([^/]+)', url_str)
            if match:
                hostname = match.group(1).split(':')[0].lower()
                if self._is_valid_subdomain(hostname, domain):
                    subdomains.add(hostname)

    return subdomains


def _query_certspotter(self, domain: str, timeout: int) -> Set[str]:
    """Query CertSpotter API for certificate transparency data."""
    url = f"https://api.certspotter.com/v1/issuances?domain={domain}&include_subdomains=true&expand=dns_names"
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

    session = self._get_session()
    response = session.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    subdomains = set()
    data = response.json()

    for cert in data:
        for name in cert.get('dns_names', []):
            name = name.strip().lower().lstrip('*.')
            if self._is_valid_subdomain(name, domain):
                subdomains.add(name)

    return subdomains


def _query_jldc(self, domain: str, timeout: int) -> Set[str]:
    """Query JLDC Anubis API for subdomains."""
    url = f"https://jldc.me/anubis/subdomains/{domain}"
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; iScope/1.0)'}

    session = self._get_session()
    response = session.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    subdomains = set()
    data = response.json()

    for subdomain in data:
        name = subdomain.strip().lower()
        if self._is_valid_subdomain(name, domain):
            subdomains.add(name)

    return subdomains
```

### Atualização do Método `run()`

Adicionar chamadas para as novas fontes após as existentes:

```python
# 4. RapidDNS
try:
    rapid_results = self._query_rapiddns(domain, timeout)
    for sub in rapid_results:
        if sub not in all_subdomains:
            all_subdomains[sub] = {'subdomain': sub, 'sources': ['rapiddns']}
        elif 'rapiddns' not in all_subdomains[sub]['sources']:
            all_subdomains[sub]['sources'].append('rapiddns')
    sources_used.append(f"rapiddns ({len(rapid_results)})")
    self.logger.info(f"Step {step_id}: rapiddns returned {len(rapid_results)} subdomains")
except Exception as e:
    errors.append(f"rapiddns: {str(e)}")
    self.logger.warning(f"Step {step_id}: rapiddns error - {e}")

# 5. ThreatMiner
try:
    tm_results = self._query_threatminer(domain, timeout)
    for sub in tm_results:
        if sub not in all_subdomains:
            all_subdomains[sub] = {'subdomain': sub, 'sources': ['threatminer']}
        elif 'threatminer' not in all_subdomains[sub]['sources']:
            all_subdomains[sub]['sources'].append('threatminer')
    sources_used.append(f"threatminer ({len(tm_results)})")
    self.logger.info(f"Step {step_id}: threatminer returned {len(tm_results)} subdomains")
except Exception as e:
    errors.append(f"threatminer: {str(e)}")
    self.logger.warning(f"Step {step_id}: threatminer error - {e}")

# 6. URLScan.io
try:
    urlscan_results = self._query_urlscan(domain, timeout)
    for sub in urlscan_results:
        if sub not in all_subdomains:
            all_subdomains[sub] = {'subdomain': sub, 'sources': ['urlscan']}
        elif 'urlscan' not in all_subdomains[sub]['sources']:
            all_subdomains[sub]['sources'].append('urlscan')
    sources_used.append(f"urlscan ({len(urlscan_results)})")
    self.logger.info(f"Step {step_id}: urlscan returned {len(urlscan_results)} subdomains")
except Exception as e:
    errors.append(f"urlscan: {str(e)}")
    self.logger.warning(f"Step {step_id}: urlscan error - {e}")

# 7. Wayback Machine
try:
    wb_results = self._query_wayback(domain, timeout)
    for sub in wb_results:
        if sub not in all_subdomains:
            all_subdomains[sub] = {'subdomain': sub, 'sources': ['wayback']}
        elif 'wayback' not in all_subdomains[sub]['sources']:
            all_subdomains[sub]['sources'].append('wayback')
    sources_used.append(f"wayback ({len(wb_results)})")
    self.logger.info(f"Step {step_id}: wayback returned {len(wb_results)} subdomains")
except Exception as e:
    errors.append(f"wayback: {str(e)}")
    self.logger.warning(f"Step {step_id}: wayback error - {e}")

# 8. CertSpotter
try:
    cs_results = self._query_certspotter(domain, timeout)
    for sub in cs_results:
        if sub not in all_subdomains:
            all_subdomains[sub] = {'subdomain': sub, 'sources': ['certspotter']}
        elif 'certspotter' not in all_subdomains[sub]['sources']:
            all_subdomains[sub]['sources'].append('certspotter')
    sources_used.append(f"certspotter ({len(cs_results)})")
    self.logger.info(f"Step {step_id}: certspotter returned {len(cs_results)} subdomains")
except Exception as e:
    errors.append(f"certspotter: {str(e)}")
    self.logger.warning(f"Step {step_id}: certspotter error - {e}")

# 9. JLDC Anubis
try:
    jldc_results = self._query_jldc(domain, timeout)
    for sub in jldc_results:
        if sub not in all_subdomains:
            all_subdomains[sub] = {'subdomain': sub, 'sources': ['jldc']}
        elif 'jldc' not in all_subdomains[sub]['sources']:
            all_subdomains[sub]['sources'].append('jldc')
    sources_used.append(f"jldc ({len(jldc_results)})")
    self.logger.info(f"Step {step_id}: jldc returned {len(jldc_results)} subdomains")
except Exception as e:
    errors.append(f"jldc: {str(e)}")
    self.logger.warning(f"Step {step_id}: jldc error - {e}")
```

### Resumo das Fontes

| # | Fonte | Tipo de Dados |
|---|-------|---------------|
| 1 | crt.sh | Certificate Transparency |
| 2 | HackerTarget | DNS records |
| 3 | AlienVault OTX | Passive DNS |
| 4 | RapidDNS | DNS aggregator |
| 5 | ThreatMiner | Threat intelligence |
| 6 | URLScan.io | Web scan results |
| 7 | Wayback Machine | Historical URLs |
| 8 | CertSpotter | Certificate Transparency |
| 9 | JLDC Anubis | Subdomain aggregator |

### Benefícios

- **Redundancia**: Se uma fonte falhar, as outras continuam funcionando
- **Cobertura ampliada**: Diferentes fontes capturam diferentes subdomínios
- **Dados históricos**: Wayback Machine encontra subdomínios antigos que podem ter sido removidos
- **Sem dependencia de API keys**: Todas funcionam gratuitamente

### Deploy

1. Atualizar o arquivo `subdomain_enum.py` no servidor
2. Limpar cache: `rm -rf /opt/iscope-agent/agent/__pycache__ /opt/iscope-agent/agent/executors/__pycache__`
3. Reiniciar: `systemctl restart iscope-agent`
4. Disparar nova analise de External Domain

