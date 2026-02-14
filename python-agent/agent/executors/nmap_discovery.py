"""
Nmap Discovery Executor - Stealth port discovery using nmap SYN scan.
Replaces masscan for attack surface scanning due to IPS evasion issues.

Returns the same format as masscan: {data: {ip, ports}}
"""

import subprocess
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional

from agent.executors.base import BaseExecutor


class NmapDiscoveryExecutor(BaseExecutor):
    """Execute nmap SYN stealth scan for port discovery."""

    # Max ports before triggering false-positive re-scan
    FALSE_POSITIVE_THRESHOLD = 500

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')

        if not ip:
            return {'error': 'IP address is required'}

        # Cloud-aware: adapt strategy based on ASN classifier result
        is_cdn = context.get('is_cdn', False)
        cdn_provider = context.get('provider', 'unknown')

        if is_cdn:
            # CDN/Edge IPs: avoid full range, use top-ports with lower rate
            port_range = '--top-ports 1000'
            max_rate = 150  # Fixed: CDN rate must be very low to avoid blocking
            timeout = params.get('timeout', 420)
            self.logger.info(
                f"[nmap_discovery] CDN detected ({cdn_provider}), "
                f"using top-1000 strategy on {ip} max_rate={max_rate}"
            )
        else:
            port_range = params.get('port_range', '1-65535')
            max_rate = params.get('max_rate', 300)
            timeout = params.get('timeout', 720)
            self.logger.info(f"[nmap_discovery] Stealth SYN scan on {ip} ports={port_range} max_rate={max_rate}")

        use_top_ports = is_cdn  # CDN uses --top-ports flag
        ports = self._run_scan(ip, port_range, max_rate, timeout, use_top_ports=use_top_ports)

        if ports is None:
            # _run_scan returned None = error already logged
            return {'data': {'ip': ip, 'ports': []}}

        # False-positive protection: cloud/CDN targets respond on everything
        # Skip if already using top-ports (CDN mode)
        if not is_cdn and len(ports) > self.FALSE_POSITIVE_THRESHOLD:
            self.logger.warning(
                f"[nmap_discovery] {len(ports)} ports found on {ip} - "
                f"likely false positives. Re-scanning with --top-ports 1000"
            )
            ports = self._run_scan(ip, '--top-ports 1000', max_rate, timeout, use_top_ports=True)
            if ports is None:
                return {'data': {'ip': ip, 'ports': []}}

        self.logger.info(f"[nmap_discovery] Found {len(ports)} open ports on {ip}: {ports[:20]}{'...' if len(ports) > 20 else ''}")

        return {
            'data': {
                'ip': ip,
                'ports': ports,
            }
        }

    def _run_scan(
        self, ip: str, port_spec: str, max_rate: int, timeout: int, use_top_ports: bool = False
    ) -> Optional[List[int]]:
        """Run nmap and return sorted list of open ports, or None on error."""

        cmd = [
            'sudo', 'nmap',
            '-sS',              # SYN stealth scan
            '-Pn',              # Skip host discovery (we know the IP is alive)
            '--open',           # Only show open ports
            '-T2',              # Polite timing - adaptive, avoids IPS thresholds
            '--max-retries', '1',    # Fewer retransmissions = less noise
            '--scan-delay', '200ms', # Space between probes to evade burst detection
            '--data-length', '24',   # Pad packets to look less like a scanner
            '--host-timeout', '600s',
            '--max-rate', str(max_rate),
            '-oX', '-',         # XML output to stdout
        ]

        if use_top_ports:
            cmd.append('--top-ports')
            cmd.append('1000')
        else:
            cmd.extend(['-p', port_spec])

        cmd.append(ip)

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            stderr = result.stderr.strip() if result.stderr else ''
            if stderr:
                # Filter out common nmap info messages
                real_errors = [
                    line for line in stderr.split('\n')
                    if not any(skip in line.lower() for skip in [
                        'starting nmap', 'nmap done', 'mass_dns',
                        'stats:', 'service detection', 'warning:'
                    ])
                ]
                if real_errors:
                    self.logger.warning(f"[nmap_discovery] stderr: {'; '.join(real_errors[:3])}")

            return self._parse_xml(result.stdout)

        except subprocess.TimeoutExpired as e:
            # Timeout: try to salvage partial output
            partial = ''
            if hasattr(e, 'stdout') and e.stdout:
                partial = e.stdout if isinstance(e.stdout, str) else e.stdout.decode('utf-8', errors='ignore')
            if partial:
                ports = self._parse_xml(partial)
                self.logger.info(f"[nmap_discovery] Timeout on {ip}, salvaged {len(ports)} ports")
                return ports
            self.logger.info(f"[nmap_discovery] Timeout on {ip}, no partial results")
            return []
        except FileNotFoundError:
            self.logger.error("[nmap_discovery] nmap not installed")
            return None
        except Exception as e:
            self.logger.error(f"[nmap_discovery] Error: {str(e)}")
            return None

    def _parse_xml(self, xml_output: str) -> List[int]:
        """Parse nmap XML output and extract open port numbers."""
        ports = []
        try:
            root = ET.fromstring(xml_output)
            for port_el in root.iter('port'):
                state_el = port_el.find('state')
                if state_el is not None and state_el.get('state') == 'open':
                    try:
                        ports.append(int(port_el.get('portid', 0)))
                    except (ValueError, TypeError):
                        continue
        except ET.ParseError:
            # Try to extract ports from partial/malformed XML
            import re
            for match in re.finditer(r'portid="(\d+)".*?state="open"', xml_output):
                try:
                    ports.append(int(match.group(1)))
                except ValueError:
                    continue

        return sorted(set(ports))
