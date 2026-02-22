"""
Nmap Executor - Service fingerprinting using nmap.
Used by Super Agents for attack surface scanning.

Two-phase model:
  Phase 1: Main scan with -sV + all PORT_SCRIPTS + global scripts (banner, ssl-cert, vulners)
  Phase 2: Conditional enrichment for exotic ports (services detected by -sV on
           ports not mapped in PORT_SCRIPTS, enriched via SERVICE_SCRIPTS)
"""

import subprocess
import xml.etree.ElementTree as ET
from typing import Dict, Any, List

from agent.executors.base import BaseExecutor

# ---------------------------------------------------------------------------
# Contextual NSE scripts per well-known port (used in Phase 1)
# ---------------------------------------------------------------------------
PORT_SCRIPTS: Dict[int, List[str]] = {
    21:    ['ftp-anon', 'ftp-syst', 'ftp-bounce'],
    22:    ['ssh-hostkey', 'ssh2-enum-algos'],
    25:    ['smtp-commands', 'smtp-ntlm-info', 'smtp-open-relay'],
    53:    ['dns-zone-transfer'],
    80:    ['http-title', 'http-server-header', 'http-headers',
            'http-security-headers', 'http-methods', 'http-robots.txt'],
    161:   ['snmp-info', 'snmp-sysdescr', 'snmp-brute'],
    389:   ['ldap-rootdse'],
    443:   ['http-title', 'http-server-header', 'http-headers',
            'ssl-cert', 'ssl-enum-ciphers', 'ssl-heartbleed', 'ssl-poodle',
            'http-security-headers', 'http-methods', 'http-robots.txt'],
    445:   ['smb-os-discovery', 'smb-protocols', 'smb-security-mode',
            'smb-vuln-ms17-010'],
    587:   ['smtp-commands', 'smtp-ntlm-info', 'smtp-open-relay'],
    636:   ['ldap-rootdse', 'ssl-enum-ciphers', 'ssl-heartbleed'],
    1433:  ['ms-sql-info', 'ms-sql-ntlm-info'],
    3306:  ['mysql-info', 'mysql-empty-password'],
    3389:  ['rdp-ntlm-info', 'rdp-enum-encryption', 'rdp-vuln-ms12-020'],
    5432:  ['pgsql-info'],
    6379:  ['redis-info'],
    8080:  ['http-title', 'http-server-header', 'http-headers',
            'http-security-headers', 'http-methods'],
    8443:  ['http-title', 'http-server-header', 'http-headers',
            'ssl-cert', 'ssl-enum-ciphers',
            'http-security-headers', 'http-methods'],
    27017: ['mongodb-info'],
}

# ---------------------------------------------------------------------------
# Contextual NSE scripts per detected service name (used in Phase 2 for
# exotic / non-standard ports where -sV identified the service)
# ---------------------------------------------------------------------------
SERVICE_SCRIPTS: Dict[str, List[str]] = {
    'http':          ['http-title', 'http-server-header', 'http-headers',
                      'http-security-headers', 'http-methods', 'http-robots.txt'],
    'https':         ['http-title', 'http-server-header', 'http-headers',
                      'ssl-cert', 'ssl-enum-ciphers', 'ssl-heartbleed',
                      'http-security-headers', 'http-methods', 'http-robots.txt'],
    'ssl':           ['ssl-cert', 'ssl-enum-ciphers', 'ssl-heartbleed', 'ssl-poodle'],
    'ssh':           ['ssh-hostkey', 'ssh2-enum-algos'],
    'ftp':           ['ftp-anon', 'ftp-syst', 'ftp-bounce'],
    'smtp':          ['smtp-commands', 'smtp-ntlm-info', 'smtp-open-relay'],
    'snmp':          ['snmp-info', 'snmp-sysdescr', 'snmp-brute'],
    'ldap':          ['ldap-rootdse'],
    'smb':           ['smb-os-discovery', 'smb-protocols', 'smb-security-mode',
                      'smb-vuln-ms17-010'],
    'ms-sql-s':      ['ms-sql-info', 'ms-sql-ntlm-info'],
    'mysql':         ['mysql-info', 'mysql-empty-password'],
    'ms-wbt-server': ['rdp-ntlm-info', 'rdp-enum-encryption', 'rdp-vuln-ms12-020'],
    'postgresql':    ['pgsql-info'],
    'redis':         ['redis-info'],
    'mongodb':       ['mongodb-info'],
    'domain':        ['dns-zone-transfer'],
}

# Scripts included globally in every Phase 1 scan (service-agnostic)
GLOBAL_SCRIPTS: List[str] = ['banner', 'ssl-cert', 'vulners']


class NmapExecutor(BaseExecutor):
    """Execute nmap service version detection on discovered ports."""

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')

        if not ip:
            return {'error': 'IP address is required'}

        ports = params.get('ports', [])
        if not ports:
            ports = context.get('ports', [])

        if not ports:
            self.logger.info(f"[nmap] No ports to scan on {ip}")
            return {'data': {'ip': ip, 'services': []}}

        # Limit to first 100 ports to avoid excessive scan times
        if len(ports) > 100:
            self.logger.warning(f"[nmap] Limiting scan to first 100 of {len(ports)} ports")
            ports = ports[:100]

        port_str = ','.join(str(p) for p in ports)
        timeout = params.get('timeout', 600)

        # --- Phase 1: Main scan with pre-computed scripts ----------------
        contextual_scripts = self._compute_port_scripts(ports)
        all_scripts = list(GLOBAL_SCRIPTS)
        for s in contextual_scripts:
            if s not in all_scripts:
                all_scripts.append(s)
        script_str = ','.join(all_scripts)

        self.logger.info(
            f"[nmap] Phase 1: scanning {ip} ports={port_str[:80]}... "
            f"scripts={len(all_scripts)}"
        )

        cmd = [
            'nmap', '-sT', '-Pn', '-sV',
            '--version-intensity', '5',
            f'--script={script_str}',
            f'-p{port_str}',
            ip,
            '-oX', '-',
            '-T3',
            '--host-timeout', '120s',
            '--max-retries', '1',
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=timeout,
            )

            if result.stderr and result.stderr.strip():
                self.logger.warning(f"[nmap] stderr: {result.stderr[:500]}")

            services = self._parse_nmap_xml(result.stdout)
            os_info = self._parse_os_info(result.stdout)

            # Fallback: if no fingerprints at all, retry lighter
            has_fingerprint = any(
                s.get('product') or s.get('cpe') for s in services
            )
            if not has_fingerprint and ports:
                self.logger.warning(
                    f"[nmap] No fingerprints on {ip} with {len(services)} open ports. "
                    f"Retrying with lighter scan..."
                )
                cmd_fallback = [
                    'nmap', '-sT', '-Pn', '-sV',
                    '--version-intensity', '3',
                    '--script=banner',
                    f'-p{port_str}',
                    ip,
                    '-oX', '-',
                    '-T3',
                    '--host-timeout', '60s',
                    '--max-retries', '1',
                ]
                result2 = subprocess.run(
                    cmd_fallback, capture_output=True, text=True, timeout=timeout,
                )
                if result2.stderr and result2.stderr.strip():
                    self.logger.warning(f"[nmap-fallback] stderr: {result2.stderr[:500]}")

                services = self._parse_nmap_xml(result2.stdout)
                if not os_info:
                    os_info = self._parse_os_info(result2.stdout)
                self.logger.info(f"[nmap-fallback] Found {len(services)} services on {ip}")

            self.logger.info(f"[nmap] Phase 1 found {len(services)} services on {ip}")

            # --- Phase 2: Enrich exotic ports ----------------------------
            services = self._enrich_exotic_ports(ip, services, timeout)

            return {
                'data': {
                    'ip': ip,
                    'services': services,
                    'os': os_info,
                }
            }

        except subprocess.TimeoutExpired:
            return {'error': f'nmap timeout after {timeout}s on {ip}'}
        except FileNotFoundError:
            return {'error': 'nmap not installed. Run: apt install -y nmap'}
        except Exception as e:
            return {'error': f'nmap error: {str(e)}'}

    # ------------------------------------------------------------------
    # Phase helpers
    # ------------------------------------------------------------------

    def _compute_port_scripts(self, ports: List[int]) -> List[str]:
        """Gather unique NSE scripts for all ports that have PORT_SCRIPTS entries."""
        scripts: List[str] = []
        for port in ports:
            for s in PORT_SCRIPTS.get(port, []):
                if s not in scripts:
                    scripts.append(s)
        return scripts

    def _enrich_exotic_ports(
        self, ip: str, services: List[Dict[str, Any]], timeout: int
    ) -> List[Dict[str, Any]]:
        """Run targeted NSE scripts on exotic ports not covered by PORT_SCRIPTS."""
        exotic: Dict[int, List[str]] = {}

        for svc in services:
            port = svc['port']
            # Skip ports already covered by PORT_SCRIPTS in Phase 1
            if port in PORT_SCRIPTS:
                continue

            svc_name = svc.get('name', '')
            if svc_name in SERVICE_SCRIPTS:
                # Determine which scripts are missing for this port
                already_ran = set(svc.get('scripts', {}).keys())
                needed = [s for s in SERVICE_SCRIPTS[svc_name] if s not in already_ran]
                if needed:
                    exotic[port] = needed

        if not exotic:
            return services

        # Build a single nmap call for all exotic ports
        target_ports = list(exotic.keys())
        all_scripts: List[str] = []
        for sl in exotic.values():
            for s in sl:
                if s not in all_scripts:
                    all_scripts.append(s)

        port_str = ','.join(str(p) for p in target_ports)
        script_str = ','.join(all_scripts)

        self.logger.info(
            f"[nmap-phase2] Enriching exotic ports on {ip} "
            f"ports={port_str} scripts={script_str}"
        )

        cmd = [
            'nmap', '-sT', '-Pn',
            f'--script={script_str}',
            f'-p{port_str}',
            ip,
            '-oX', '-',
            '-T4',
            '--host-timeout', '60s',
            '--max-retries', '1',
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=min(timeout, 120),
            )

            if result.stderr and result.stderr.strip():
                self.logger.warning(f"[nmap-phase2] stderr: {result.stderr[:500]}")

            enriched = self._parse_nmap_xml(result.stdout)

            # Merge enriched scripts into existing services
            enrich_map: Dict[int, Dict[str, str]] = {}
            for svc in enriched:
                if svc.get('scripts'):
                    enrich_map[svc['port']] = svc['scripts']

            for svc in services:
                extra = enrich_map.get(svc['port'])
                if extra:
                    svc['scripts'].update(extra)

            self.logger.info(
                f"[nmap-phase2] Enriched {len(enrich_map)} exotic services on {ip}"
            )

        except subprocess.TimeoutExpired:
            self.logger.warning(f"[nmap-phase2] Timeout on {ip}, keeping Phase 1 results")
        except Exception as e:
            self.logger.warning(f"[nmap-phase2] Error on {ip}: {e}, keeping Phase 1 results")

        return services

    # ------------------------------------------------------------------
    # XML parsing
    # ------------------------------------------------------------------

    def _parse_nmap_xml(self, xml_output: str) -> List[Dict[str, Any]]:
        """Parse nmap XML output into structured service data."""
        services = []
        try:
            root = ET.fromstring(xml_output)
            for host in root.findall('.//host'):
                for port_elem in host.findall('.//port'):
                    state = port_elem.find('state')
                    if state is not None and state.get('state') != 'open':
                        continue

                    service_elem = port_elem.find('service')
                    port_num = int(port_elem.get('portid', 0))
                    protocol = port_elem.get('protocol', 'tcp')

                    service = {
                        'port': port_num,
                        'protocol': protocol,
                        'product': '',
                        'version': '',
                        'cpe': [],
                        'scripts': {},
                    }

                    if service_elem is not None:
                        service['product'] = service_elem.get('product', '')
                        service['version'] = service_elem.get('version', '')
                        service['extra_info'] = service_elem.get('extrainfo', '')
                        service['name'] = service_elem.get('name', '')

                        for cpe in service_elem.findall('cpe'):
                            if cpe.text:
                                service['cpe'].append(cpe.text)

                    # Parse script output
                    for script in port_elem.findall('.//script'):
                        script_id = script.get('id', '')
                        script_output = script.get('output', '')
                        if script_id:
                            service['scripts'][script_id] = script_output

                    services.append(service)
        except ET.ParseError as e:
            self.logger.warning(f"[nmap] XML parse error: {e}")

        return services

    def _parse_os_info(self, xml_output: str) -> str:
        """Extract OS detection info from nmap XML."""
        try:
            root = ET.fromstring(xml_output)
            for osmatch in root.findall('.//osmatch'):
                return osmatch.get('name', '')
        except ET.ParseError:
            pass
        return ''
