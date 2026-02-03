"""
Amass Executor - Subdomain enumeration using OWASP Amass.

Supports Amass v4.x text output format with source tracking.
"""

import re
import shutil
import subprocess
import time as _time
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
            # Build command (Amass v4.x)
            # Ensure timeout in minutes is at least 1
            timeout_minutes = max(1, int(timeout / 60))
            
            cmd = [
                amass_path,
                'enum',
                '-d', domain,
                '-timeout', str(timeout_minutes),
                '-nocolor',  # Better for parsing
                '-src',      # Show source for each result
            ]

            if mode == 'passive':
                cmd.append('-passive')
            elif mode == 'active':
                cmd.extend(['-active', '-brute'])
                if max_depth > 1:
                    cmd.extend(['-max-depth', str(max_depth)])

            # Detailed logging before execution
            self.logger.info(f"Step {step_id}: Command: {' '.join(cmd)}")
            self.logger.info(f"Step {step_id}: Timeout: {timeout}s ({timeout_minutes}min), CWD: /tmp")
            
            exec_start = _time.time()

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 30,  # Extra buffer
                cwd='/tmp'
            )
            
            exec_ms = int((_time.time() - exec_start) * 1000)

            # Detailed logging after execution
            self.logger.info(
                f"Step {step_id}: Amass finished in {exec_ms}ms | "
                f"RC={result.returncode} | "
                f"stdout={len(result.stdout or '')} chars | "
                f"stderr={len(result.stderr or '')} chars"
            )
            
            # Log first lines of stdout/stderr for debug
            if result.stdout:
                first_lines = '\n'.join(result.stdout.strip().split('\n')[:5])
                self.logger.info(f"Step {step_id}: STDOUT preview:\n{first_lines}")
            if result.stderr:
                self.logger.info(f"Step {step_id}: STDERR: {result.stderr.strip()[:200]}")

            # Parse text output (Amass v4.x format with -src flag)
            combined_output = (result.stdout or '') + '\n' + (result.stderr or '')
            subdomains, sources_set, unparsed = self._parse_amass_output(combined_output, domain)

            # Sort alphabetically
            subdomains.sort(key=lambda x: x['subdomain'])

            # Log unparsed lines for debug
            if unparsed:
                self.logger.info(f"Step {step_id}: Unparsed lines ({len(unparsed)}): {unparsed[:5]}")

            self.logger.info(
                f"Step {step_id}: Amass found {len(subdomains)} unique subdomains "
                f"from {len(sources_set)} sources: {sorted(list(sources_set))}"
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

    def _parse_amass_output(self, output: str, base_domain: str) -> Tuple[List[Dict], Set[str], List[str]]:
        """
        Parse Amass v4.x text output format with -src flag.
        
        Format examples (with -src flag):
            [crt.sh] subdomain.example.com (FQDN) --> a_record --> 192.168.1.1 (IPAddress)
            [Crtsh] www.example.com (FQDN) --> cname_record --> target.cdn.com (FQDN)
        
        Format examples (without -src flag):
            subdomain.example.com (FQDN) --> a_record --> 192.168.1.1 (IPAddress)
            
        Also captures:
            Querying Crtsh for example.com subdomains
        
        Returns:
            Tuple of (subdomains list, sources set, unparsed lines list)
        """
        subdomains: Dict[str, Dict] = {}
        sources_set: Set[str] = set()
        unparsed_lines: List[str] = []
        
        # Known non-result lines to skip
        skip_patterns = [
            'The enumeration has finished',
            'Querying ',
            'Starting ',
            'OWASP Amass',
            'https://',
            'Discoveries are being',
        ]
        
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            
            # Skip known informational lines
            if any(pattern in line for pattern in skip_patterns):
                # Extract sources from "Querying X for domain" lines
                if line.startswith('Querying '):
                    source_match = re.match(r'Querying (\S+) for', line)
                    if source_match:
                        sources_set.add(source_match.group(1))
                continue
            
            # Try to parse line with source prefix: "[source] name (FQDN) --> ..."
            source_match = re.match(r'^\[([^\]]+)\]\s+([^\s]+)\s*\(FQDN\)', line)
            if source_match:
                source = source_match.group(1)
                name = source_match.group(2).lower()
                sources_set.add(source)
                
                if not self._is_valid_subdomain(name, base_domain):
                    continue
                
                if name not in subdomains:
                    subdomains[name] = {
                        'subdomain': name,
                        'sources': [source],
                        'addresses': [],
                    }
                elif source not in subdomains[name]['sources']:
                    subdomains[name]['sources'].append(source)
                
                # Extract IP addresses from the line
                self._extract_addresses(line, subdomains[name])
                continue
            
            # Try to parse line without source prefix: "name (FQDN) --> ..."
            if ' --> ' in line:
                no_source_match = re.match(r'^([^\s]+)\s*\(FQDN\)', line)
                if no_source_match:
                    name = no_source_match.group(1).lower()
                    
                    if not self._is_valid_subdomain(name, base_domain):
                        continue
                    
                    if name not in subdomains:
                        subdomains[name] = {
                            'subdomain': name,
                            'sources': [],
                            'addresses': [],
                        }
                    
                    # Extract IP addresses from the line
                    self._extract_addresses(line, subdomains[name])
                    continue
            
            # Line was not parsed - collect for debug
            unparsed_lines.append(line[:100])
        
        return list(subdomains.values()), sources_set, unparsed_lines

    def _extract_addresses(self, line: str, subdomain_entry: Dict) -> None:
        """Extract IP addresses from an Amass output line."""
        existing_ips = [a.get('ip') for a in subdomain_entry['addresses']]
        
        # IPv4 address
        ipv4_matches = re.findall(r'(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*\(IPAddress\)', line)
        for ip in ipv4_matches:
            if ip not in existing_ips:
                subdomain_entry['addresses'].append({'ip': ip, 'type': 'A'})
                existing_ips.append(ip)
        
        # IPv6 address
        ipv6_matches = re.findall(r'([a-fA-F0-9:]+)\s*\(IPAddress\)', line)
        for ip in ipv6_matches:
            if ':' in ip and ip not in existing_ips:
                subdomain_entry['addresses'].append({'ip': ip, 'type': 'AAAA'})
                existing_ips.append(ip)

    def _is_valid_subdomain(self, name: str, base_domain: str) -> bool:
        """Check if name is a valid subdomain of base_domain (excludes base domain itself)."""
        name = name.lstrip('*.').lower()
        base_domain = base_domain.lower()
        
        if not name:
            return False
        
        # IMPORTANT: Exclude the base domain itself
        if name == base_domain:
            return False
        
        return name.endswith(f".{base_domain}")
