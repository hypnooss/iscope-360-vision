"""
httpx Executor - Web technology fingerprinting using projectdiscovery/httpx.
Used by Super Agents for attack surface scanning.
"""

import json
import subprocess
from typing import Dict, Any, List

from agent.executors.base import BaseExecutor


class HttpxExecutor(BaseExecutor):
    """Execute httpx for web service discovery and technology detection."""

    # Common HTTP/HTTPS ports to probe
    DEFAULT_HTTP_PORTS = [80, 443, 8080, 8443, 8000, 8888, 3000, 5000, 9090]

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')
        hostname = params.get('hostname') or context.get('hostname')

        # Use hostname for httpx when available (proper Host/SNI headers)
        target = hostname if hostname else ip

        if not target:
            return {'error': 'IP or hostname is required'}

        # Use ports from params, context (previous step), or defaults
        ports = params.get('ports', [])
        if not ports:
            all_ports = context.get('ports', [])
            # Probe all discovered ports - web servers can run on any port
            ports = all_ports if all_ports else self.DEFAULT_HTTP_PORTS[:4]

        port_str = ','.join(str(p) for p in ports)
        timeout = params.get('timeout', 60)

        self.logger.info(f"[httpx] Probing {target} ports={port_str}" + (f" (ip={ip})" if hostname else ""))

        cmd = [
            'httpx',
            '-u', target,
            '-ports', port_str,
            '-tech-detect',
            '-status-code',
            '-title',
            '-server',
            '-tls-grab',
            '-json',
            '-silent',
            '-no-color',
            '-timeout', '10',
            '-retries', '1',
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                input='',
            )

            web_services = self._parse_output(result.stdout)
            self.logger.info(f"[httpx] Found {len(web_services)} web services on {target}")

            return {
                'data': {
                    'ip': ip,
                    'hostname': hostname or '',
                    'web_services': web_services,
                }
            }

        except subprocess.TimeoutExpired:
            return {'error': f'httpx timeout after {timeout}s on {ip}'}
        except FileNotFoundError:
            return {'error': 'httpx not installed. Install from https://github.com/projectdiscovery/httpx'}
        except Exception as e:
            return {'error': f'httpx error: {str(e)}'}

    def _parse_output(self, stdout: str) -> List[Dict[str, Any]]:
        """Parse httpx JSON lines output."""
        web_services = []
        for line in stdout.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                service = {
                    'url': entry.get('url', ''),
                    'status_code': entry.get('status_code', 0),
                    'title': entry.get('title', ''),
                    'server': entry.get('webserver', ''),
                    'technologies': entry.get('tech', []),
                    'content_length': entry.get('content_length', 0),
                    'tls': {},
                }

                # TLS info
                tls = entry.get('tls-grab', {}) or entry.get('tls', {})
                if tls:
                    service['tls'] = {
                        'version': tls.get('version', ''),
                        'cipher': tls.get('cipher', ''),
                        'subject_cn': tls.get('subject_cn', '') or tls.get('host', ''),
                        'issuer': tls.get('issuer_org', ''),
                        'not_after': tls.get('not_after', ''),
                    }

                web_services.append(service)
            except json.JSONDecodeError:
                continue

        return web_services
