"""
Subdomain Enumeration Executor - Multi-source subdomain discovery.
Uses free APIs: crt.sh, HackerTarget, AlienVault OTX, RapidDNS, ThreatMiner,
URLScan.io, Wayback Machine, CertSpotter, JLDC Anubis.
Forces IPv4 to avoid IPv6 connectivity issues.
"""

import re
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
        config = step.get('config', {}) or {}
        step_id = step.get('id', 'unknown')

        domain = (config.get('domain') or context.get('domain') or '').strip().rstrip('.')
        timeout = config.get('timeout', self.DEFAULT_TIMEOUT)

        if not domain:
            return {'status_code': 0, 'data': None, 'error': 'Missing domain'}

        self.logger.info(f"Step {step_id}: Starting subdomain enumeration for {domain}")

        all_subdomains: Dict[str, Dict] = {}
        sources_used: List[str] = []
        errors: List[str] = []

        # 1. crt.sh (Certificate Transparency) - Most effective
        try:
            crt_results = self._query_crtsh(domain, timeout)
            for sub in crt_results:
                if sub not in all_subdomains:
                    all_subdomains[sub] = {'subdomain': sub, 'sources': ['crt.sh']}
                elif 'crt.sh' not in all_subdomains[sub]['sources']:
                    all_subdomains[sub]['sources'].append('crt.sh')
            sources_used.append(f"crt.sh ({len(crt_results)})")
            self.logger.info(f"Step {step_id}: crt.sh returned {len(crt_results)} subdomains")
        except Exception as e:
            errors.append(f"crt.sh: {str(e)}")
            self.logger.warning(f"Step {step_id}: crt.sh error - {e}")

        # 2. HackerTarget API
        try:
            ht_results = self._query_hackertarget(domain, timeout)
            for sub in ht_results:
                if sub not in all_subdomains:
                    all_subdomains[sub] = {'subdomain': sub, 'sources': ['hackertarget']}
                elif 'hackertarget' not in all_subdomains[sub]['sources']:
                    all_subdomains[sub]['sources'].append('hackertarget')
            sources_used.append(f"hackertarget ({len(ht_results)})")
            self.logger.info(f"Step {step_id}: hackertarget returned {len(ht_results)} subdomains")
        except Exception as e:
            errors.append(f"hackertarget: {str(e)}")
            self.logger.warning(f"Step {step_id}: hackertarget error - {e}")

        # 3. AlienVault OTX (gratuito, sem API key para consultas básicas)
        try:
            otx_results = self._query_alienvault(domain, timeout)
            for sub in otx_results:
                if sub not in all_subdomains:
                    all_subdomains[sub] = {'subdomain': sub, 'sources': ['alienvault']}
                elif 'alienvault' not in all_subdomains[sub]['sources']:
                    all_subdomains[sub]['sources'].append('alienvault')
            sources_used.append(f"alienvault ({len(otx_results)})")
            self.logger.info(f"Step {step_id}: alienvault returned {len(otx_results)} subdomains")
        except Exception as e:
            errors.append(f"alienvault: {str(e)}")
            self.logger.warning(f"Step {step_id}: alienvault error - {e}")

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

        # Validate subdomains via DNS resolution
        all_subdomains = self._validate_subdomains(all_subdomains, step_id)

        # Separate alive and dead subdomains for stats
        alive_subdomains = {k: v for k, v in all_subdomains.items() if v.get('is_alive')}
        dead_subdomains = {k: v for k, v in all_subdomains.items() if not v.get('is_alive')}

        # Sort results
        subdomains_list = sorted(all_subdomains.values(), key=lambda x: x['subdomain'])

        self.logger.info(
            f"Step {step_id}: Total {len(subdomains_list)} unique subdomains from {len(sources_used)} sources "
            f"({len(alive_subdomains)} alive, {len(dead_subdomains)} inactive)"
        )

        return {
            'status_code': 200,
            'data': {
                'domain': domain,
                'total_found': len(subdomains_list),
                'alive_count': len(alive_subdomains),
                'inactive_count': len(dead_subdomains),
                'sources': sources_used,
                'subdomains': subdomains_list,
                'errors': errors if errors else None,
            },
            'error': None,
        }

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
            # Split by newline (wildcard certs may have multiple names)
            for name in name_value.split('\n'):
                name = name.strip().lower().lstrip('*.')
                if self._is_valid_subdomain(name, domain):
                    subdomains.add(name)

        return subdomains

    def _query_hackertarget(self, domain: str, timeout: int) -> Set[str]:
        """Query HackerTarget API (100 free requests/day)."""
        url = f"https://api.hackertarget.com/hostsearch/?q={domain}"

        session = self._get_session()
        response = session.get(url, timeout=timeout)
        response.raise_for_status()

        subdomains = set()

        # Format: subdomain,ip
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

    def _query_rapiddns(self, domain: str, timeout: int) -> Set[str]:
        """Query RapidDNS.io for subdomains."""
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
        
        # Handle empty response
        if not response.text.strip():
            return subdomains
            
        data = response.json()

        # Skip header row
        for row in data[1:] if len(data) > 1 else []:
            if row:
                # Extract domain from URL
                url_str = row[0] if isinstance(row, list) else row
                # Parse: https://subdomain.domain.com/path -> subdomain.domain.com
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

    def _resolve_subdomain(self, subdomain: str, timeout: float = 2.0) -> Dict[str, Any]:
        """
        Resolve a subdomain to get its IP addresses.
        Returns dict with 'ips' list and 'is_alive' boolean.
        """
        try:
            import dns.resolver
        except ImportError:
            # Fallback to socket if dnspython not available
            try:
                ips = list(set(socket.gethostbyname_ex(subdomain)[2]))
                return {'ips': sorted(ips), 'is_alive': len(ips) > 0}
            except socket.gaierror:
                return {'ips': [], 'is_alive': False}
            except Exception:
                return {'ips': [], 'is_alive': False}

        resolver = dns.resolver.Resolver(configure=True)
        resolver.lifetime = timeout
        resolver.timeout = timeout

        ips = set()

        # Try A records (IPv4)
        try:
            answers = resolver.resolve(subdomain, 'A')
            for r in answers:
                ips.add(str(r))
        except Exception:
            pass

        # Try AAAA records (IPv6)
        try:
            answers = resolver.resolve(subdomain, 'AAAA')
            for r in answers:
                ips.add(str(r))
        except Exception:
            pass

        return {
            'ips': sorted(list(ips)),
            'is_alive': len(ips) > 0
        }

    def _validate_subdomains(self, subdomains: Dict[str, Dict], step_id: str) -> Dict[str, Dict]:
        """
        Validate all discovered subdomains by resolving their DNS.
        Adds 'ips' and 'is_alive' to each subdomain entry.
        """
        total = len(subdomains)
        alive_count = 0

        self.logger.info(f"Step {step_id}: Validating {total} subdomains via DNS resolution...")

        for idx, (name, data) in enumerate(subdomains.items(), 1):
            result = self._resolve_subdomain(name)
            data['ips'] = result['ips']
            data['is_alive'] = result['is_alive']

            if result['is_alive']:
                alive_count += 1

            # Log progress every 10 subdomains
            if idx % 10 == 0 or idx == total:
                self.logger.info(f"Step {step_id}: Validated {idx}/{total} subdomains ({alive_count} alive)")

        self.logger.info(f"Step {step_id}: Validation complete - {alive_count}/{total} subdomains are alive")

        return subdomains

    def _is_valid_subdomain(self, name: str, base_domain: str) -> bool:
        """Check if name is a valid subdomain (excludes base domain itself)."""
        if not name:
            return False
        name = name.lower()
        base_domain = base_domain.lower()

        # Exclude the base domain itself
        if name == base_domain:
            return False

        # Must end with .base_domain
        return name.endswith(f".{base_domain}")
