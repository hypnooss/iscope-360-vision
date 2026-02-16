"""
Nmap Executor - Service fingerprinting using nmap.
Used by Super Agents for attack surface scanning.
"""

import subprocess
import xml.etree.ElementTree as ET
from typing import Dict, Any, List

from agent.executors.base import BaseExecutor

# Contextual NSE scripts per port for enrichment scan
PORT_SCRIPTS: Dict[int, List[str]] = {
    21:   ['ftp-anon', 'ftp-syst'],
    22:   ['ssh-hostkey', 'ssh2-enum-algos'],
    25:   ['smtp-commands', 'smtp-ntlm-info'],
    161:  ['snmp-info', 'snmp-sysdescr'],
    389:  ['ldap-rootdse'],
    445:  ['smb-os-discovery', 'smb-protocols', 'smb-security-mode'],
    587:  ['smtp-commands', 'smtp-ntlm-info'],
    636:  ['ldap-rootdse'],
    1433: ['ms-sql-info', 'ms-sql-ntlm-info'],
    3306: ['mysql-info'],
    3389: ['rdp-ntlm-info', 'rdp-enum-encryption'],
    5432: ['pgsql-info'],
}


class NmapExecutor(BaseExecutor):
    """Execute nmap service version detection on discovered ports."""

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')

        if not ip:
            return {'error': 'IP address is required'}

        ports = params.get('ports', [])
        if not ports:
            # Try to get ports from previous step context
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

        self.logger.info(f"[nmap] TCP connect scanning {ip} ports={port_str[:80]}...")

        # Primary scan: optimized for speed (ports already confirmed open)
        cmd = [
            'nmap', '-sT', '-sV',
            '--version-intensity', '5',
            '--script=banner,ssl-cert',
            f'-p{port_str}',
            ip,
            '-oX', '-',
            '-T4',
            '--host-timeout', '120s',
            '--max-retries', '1',
        ]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            if result.stderr and result.stderr.strip():
                self.logger.warning(f"[nmap] stderr: {result.stderr[:500]}")

            services = self._parse_nmap_xml(result.stdout)
            os_info = self._parse_os_info(result.stdout)

            # Fallback: if no service was actually fingerprinted, retry lighter
            has_fingerprint = any(
                s.get('product') or s.get('cpe')
                for s in services
            )
            if not has_fingerprint and ports:
                self.logger.warning(
                    f"[nmap] No fingerprints on {ip} with {len(services)} open ports. "
                    f"Retrying with lighter scan..."
                )
                cmd_fallback = [
                    'nmap', '-sT', '-sV',
                    '--version-intensity', '3',
                    '--script=banner',
                    f'-p{port_str}',
                    ip,
                    '-oX', '-',
                    '-T4',
                    '--host-timeout', '60s',
                    '--max-retries', '1',
                ]
                result2 = subprocess.run(
                    cmd_fallback,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
                if result2.stderr and result2.stderr.strip():
                    self.logger.warning(f"[nmap-fallback] stderr: {result2.stderr[:500]}")

                services = self._parse_nmap_xml(result2.stdout)
                if not os_info:
                    os_info = self._parse_os_info(result2.stdout)

                self.logger.info(f"[nmap-fallback] Found {len(services)} services on {ip}")

            self.logger.info(f"[nmap] Found {len(services)} services on {ip}")

            # Enrichment: run contextual NSE scripts for known ports
            services = self._enrich_with_contextual_scripts(ip, services, timeout)

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

    def _enrich_with_contextual_scripts(
        self, ip: str, services: List[Dict[str, Any]], timeout: int
    ) -> List[Dict[str, Any]]:
        """Run targeted NSE scripts on ports that have enrichment mappings."""
        # Find open ports that have contextual scripts
        open_ports = [s['port'] for s in services]
        target_ports = [p for p in open_ports if p in PORT_SCRIPTS]

        if not target_ports:
            return services

        # Collect unique scripts needed
        all_scripts: List[str] = []
        for p in target_ports:
            for s in PORT_SCRIPTS[p]:
                if s not in all_scripts:
                    all_scripts.append(s)

        port_str = ','.join(str(p) for p in target_ports)
        script_str = ','.join(all_scripts)

        self.logger.info(
            f"[nmap-enrich] Running contextual scripts on {ip} "
            f"ports={port_str} scripts={script_str}"
        )

        cmd = [
            'nmap', '-sT',
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
                cmd,
                capture_output=True,
                text=True,
                timeout=min(timeout, 120),
            )

            if result.stderr and result.stderr.strip():
                self.logger.warning(f"[nmap-enrich] stderr: {result.stderr[:500]}")

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
                f"[nmap-enrich] Enriched {len(enrich_map)} services on {ip}"
            )

        except subprocess.TimeoutExpired:
            self.logger.warning(f"[nmap-enrich] Timeout on {ip}, keeping base results")
        except Exception as e:
            self.logger.warning(f"[nmap-enrich] Error on {ip}: {e}, keeping base results")

        return services

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
