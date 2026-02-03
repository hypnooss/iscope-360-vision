"""
Subdomain Enumeration Executor - Multi-source subdomain discovery.
Uses free APIs: crt.sh, HackerTarget, AlienVault OTX.
"""

import requests
from typing import Any, Dict, List, Set
from .base import BaseExecutor


class SubdomainEnumExecutor(BaseExecutor):
    """Executor for subdomain enumeration using multiple free APIs."""

    DEFAULT_TIMEOUT = 30

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

        # Sort results
        subdomains_list = sorted(all_subdomains.values(), key=lambda x: x['subdomain'])

        self.logger.info(
            f"Step {step_id}: Total {len(subdomains_list)} unique subdomains from {len(sources_used)} sources"
        )

        return {
            'status_code': 200,
            'data': {
                'domain': domain,
                'total_found': len(subdomains_list),
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

        response = requests.get(url, headers=headers, timeout=timeout)
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

        response = requests.get(url, timeout=timeout)
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

        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()

        subdomains = set()
        data = response.json()

        for record in data.get('passive_dns', []):
            hostname = record.get('hostname', '').strip().lower()
            if self._is_valid_subdomain(hostname, domain):
                subdomains.add(hostname)

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
