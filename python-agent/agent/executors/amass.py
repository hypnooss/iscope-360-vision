"""
Amass Executor - Subdomain enumeration using OWASP Amass.

Supports Amass v4.x text output format.
"""

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
        """
        Execute Amass enumeration.

        Config options:
            domain: Target domain (required, can come from context)
            mode: 'passive' (default) or 'active'
            timeout: Max execution time in seconds (default: 300)
            max_depth: DNS brute force recursion depth (active mode only)

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

        amass_path = shutil.which('amass')
        if not amass_path:
            self.logger.error(f"Step {step_id}: Amass not installed")
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': 'Amass not installed. Run agent installer with --update.'
            }

        self.logger.info(f"Step {step_id}: Running Amass ({mode}) for {domain}")

        try:
            # Build command (Amass v4.x - no JSON flag)
            cmd = [
                amass_path,
                'enum',
                '-d', domain,
                '-timeout', str(int(timeout / 60)),  # Amass uses minutes
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
                timeout=timeout + 30,  # Extra buffer
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

    def _parse_amass_output(self, output: str, base_domain: str) -> Tuple[List[Dict], Set[str]]:
        """
        Parse Amass v4.x text output format.
        
        Format examples:
            subdomain.example.com (FQDN) --> a_record --> 192.168.1.1 (IPAddress)
            subdomain.example.com (FQDN) --> cname_record --> target.cdn.com (FQDN)
            Querying Crtsh for example.com subdomains
        """
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
