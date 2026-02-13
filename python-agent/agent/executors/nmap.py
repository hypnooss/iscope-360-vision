"""
Nmap Executor - Service fingerprinting using nmap.
Used by Super Agents for attack surface scanning.
"""

import subprocess
import xml.etree.ElementTree as ET
from typing import Dict, Any, List

from agent.executors.base import BaseExecutor


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

        self.logger.info(f"[nmap] Stealth scanning {ip} ports={port_str[:80]}...")

        # Primary scan: stealth, no scripts, human-like timing
        cmd = [
            'nmap', '-sV',
            '--version-intensity', '5',
            f'-p{port_str}',
            ip,
            '-oX', '-',
            '-T3',
            '--host-timeout', '300s',
            '--scan-delay', '500ms',
            '--max-retries', '2',
            '--data-length', '24',
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

            # Fallback: if zero services found, retry with targeted lightweight scripts
            if not services and ports:
                self.logger.warning(
                    f"[nmap] Zero services on {ip} with {len(ports)} ports. "
                    f"Retrying with targeted scripts (banner,ssl-cert,http-title)..."
                )
                cmd_fallback = [
                    'nmap', '-sV',
                    '--version-intensity', '7',
                    '--script=banner,ssl-cert,http-title',
                    f'-p{port_str}',
                    ip,
                    '-oX', '-',
                    '-T3',
                    '--host-timeout', '180s',
                    '--max-retries', '1',
                    '--data-length', '24',
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
