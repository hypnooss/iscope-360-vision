"""
Nmap Discovery Executor - 2-Phase TCP port discovery using nmap.

Phase 1: Rapid baseline scan (top-ports 2000, ~30s) to confirm host responsiveness.
Phase 2: Full range optimized scan (1-65535 with aggressive RTT, ~2-4 min).

Uses -sS (SYN stealth) by default with automatic fallback to -sT (TCP connect)
if permission is denied. Critical RTT parameters prevent excessive timeouts
in silent-drop environments.

Returns the same format as masscan: {data: {ip, ports}}
"""

import subprocess
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional

from agent.executors.base import BaseExecutor


class NmapDiscoveryExecutor(BaseExecutor):
    """Execute nmap 2-phase port discovery with RTT optimization."""

    # Standard web ports returned immediately for CDN/Edge IPs (no scan needed)
    CDN_WEB_PORTS = [
        80, 443, 8080, 8443, 8000, 8888,
        2052, 2053, 2082, 2083, 2086, 2087, 2095, 2096,
    ]

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')

        if not ip:
            return {'error': 'IP address is required'}

        # Cloud-aware: adapt strategy based on ASN classifier result
        is_cdn = context.get('is_cdn', False)
        cdn_provider = context.get('provider', 'unknown')

        if is_cdn:
            self.logger.info(
                f"[nmap_discovery] CDN detected ({cdn_provider}), "
                f"skipping discovery - using {len(self.CDN_WEB_PORTS)} standard web ports for {ip}"
            )
            return {
                'data': {
                    'ip': ip,
                    'ports': self.CDN_WEB_PORTS,
                }
            }

        # --- Phase 1: Rapid baseline (top-ports 2000, ~30s) ---
        self.logger.info(f"[nmap_discovery] Phase 1: baseline scan on {ip} (top-ports 2000)")
        phase1_ports = self._run_phase(
            ip=ip,
            scan_type='-sS',
            port_spec=None,
            top_ports=2000,
            host_timeout=60,
            use_min_rate=False,
            use_defeat_rst=False,
            process_timeout=90,
        )

        if phase1_ports is None:
            # None = error (not timeout). Return empty.
            return {'data': {'ip': ip, 'ports': []}}

        self.logger.info(
            f"[nmap_discovery] Phase 1 result: {len(phase1_ports)} open ports on {ip}"
            f"{': ' + str(phase1_ports[:20]) if phase1_ports else ''}"
        )

        # If Phase 1 found 0 ports, host is unresponsive — skip Phase 2
        if not phase1_ports:
            self.logger.info(
                f"[nmap_discovery] Phase 1 found 0 ports on {ip}, "
                f"skipping Phase 2 — httpx will use default ports"
            )
            return {'data': {'ip': ip, 'ports': []}}

        # --- Phase 2: Full range optimized (1-65535, ~2-4 min) ---
        self.logger.info(f"[nmap_discovery] Phase 2: full range scan on {ip} (1-65535)")
        phase2_ports = self._run_phase(
            ip=ip,
            scan_type='-sS',
            port_spec='1-65535',
            top_ports=None,
            host_timeout=300,
            use_min_rate=True,
            use_defeat_rst=True,
            process_timeout=360,
        )

        if phase2_ports is None:
            # Phase 2 failed — return Phase 1 results (still valuable)
            self.logger.warning(
                f"[nmap_discovery] Phase 2 failed on {ip}, "
                f"returning Phase 1 results ({len(phase1_ports)} ports)"
            )
            return {'data': {'ip': ip, 'ports': phase1_ports}}

        # Merge both phases (union of unique ports)
        all_ports = sorted(set(phase1_ports + phase2_ports))

        self.logger.info(
            f"[nmap_discovery] Final: {len(all_ports)} unique ports on {ip} "
            f"(P1={len(phase1_ports)}, P2={len(phase2_ports)}): "
            f"{all_ports[:20]}{'...' if len(all_ports) > 20 else ''}"
        )

        return {
            'data': {
                'ip': ip,
                'ports': all_ports,
            }
        }

    def _run_phase(
        self,
        ip: str,
        scan_type: str,
        port_spec: Optional[str],
        top_ports: Optional[int],
        host_timeout: int,
        use_min_rate: bool,
        use_defeat_rst: bool,
        process_timeout: int,
    ) -> Optional[List[int]]:
        """
        Run a single nmap phase. Returns sorted list of open ports,
        empty list on timeout, or None on hard error.

        Uses -sS by default, falls back to -sT on permission error.
        """
        cmd = self._build_cmd(
            scan_type=scan_type,
            port_spec=port_spec,
            top_ports=top_ports,
            host_timeout=host_timeout,
            use_min_rate=use_min_rate,
            use_defeat_rst=use_defeat_rst,
            ip=ip,
        )

        result = self._exec_nmap(cmd, process_timeout, ip)

        # Fallback: -sS -> -sT on permission error
        if result == 'PERMISSION_ERROR' and scan_type == '-sS':
            self.logger.warning(
                f"[nmap_discovery] -sS permission denied on {ip}, falling back to -sT"
            )
            cmd = self._build_cmd(
                scan_type='-sT',
                port_spec=port_spec,
                top_ports=top_ports,
                host_timeout=host_timeout,
                use_min_rate=use_min_rate,
                use_defeat_rst=use_defeat_rst,
                ip=ip,
            )
            result = self._exec_nmap(cmd, process_timeout, ip)

        if result == 'PERMISSION_ERROR':
            return None
        return result

    def _build_cmd(
        self,
        scan_type: str,
        port_spec: Optional[str],
        top_ports: Optional[int],
        host_timeout: int,
        use_min_rate: bool,
        use_defeat_rst: bool,
        ip: str,
    ) -> List[str]:
        """Build nmap command with RTT-optimized parameters."""
        cmd = []
        if scan_type == '-sS':
            cmd.append('sudo')
        cmd.extend([
            'nmap',
            scan_type,
            '-Pn',
            '--open',
            '-T4',
            '--max-retries', '1',
            '--initial-rtt-timeout', '150ms',
            '--max-rtt-timeout', '400ms',
            '--host-timeout', '{}s'.format(host_timeout),
            '-oX', '-',
        ]

        if use_min_rate:
            cmd.extend(['--min-rate', '800', '--max-rate', '1500'])

        if use_defeat_rst:
            cmd.append('--defeat-rst-ratelimit')

        if top_ports is not None:
            cmd.extend(['--top-ports', str(top_ports)])
        elif port_spec is not None:
            cmd.extend(['-p', port_spec])

        cmd.append(ip)
        return cmd

    def _exec_nmap(
        self, cmd: List[str], timeout: int, ip: str
    ) -> Any:
        """
        Execute nmap command. Returns:
        - List[int]: sorted open ports (success or partial from timeout)
        - 'PERMISSION_ERROR': needs fallback to -sT
        - None: hard error
        """
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            stderr = result.stderr.strip() if result.stderr else ''

            # Detect permission error for -sS fallback
            if stderr and any(
                phrase in stderr.lower()
                for phrase in [
                    'requires root',
                    'permission denied',
                    'operation not permitted',
                    'you requested a scan type which requires root',
                ]
            ):
                return 'PERMISSION_ERROR'

            if stderr:
                real_errors = [
                    line for line in stderr.split('\n')
                    if not any(skip in line.lower() for skip in [
                        'starting nmap', 'nmap done', 'mass_dns',
                        'stats:', 'service detection', 'warning:',
                        'raw packets', 'completed',
                    ])
                ]
                if real_errors:
                    self.logger.warning(
                        f"[nmap_discovery] stderr: {'; '.join(real_errors[:3])}"
                    )

            return self._parse_xml(result.stdout)

        except subprocess.TimeoutExpired as e:
            partial = ''
            if hasattr(e, 'stdout') and e.stdout:
                partial = (
                    e.stdout if isinstance(e.stdout, str)
                    else e.stdout.decode('utf-8', errors='ignore')
                )
            if partial:
                ports = self._parse_xml(partial)
                self.logger.info(
                    f"[nmap_discovery] Timeout on {ip}, salvaged {len(ports)} ports"
                )
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
            import re
            for match in re.finditer(r'portid="(\d+)".*?state="open"', xml_output):
                try:
                    ports.append(int(match.group(1)))
                except ValueError:
                    continue

        return sorted(set(ports))
