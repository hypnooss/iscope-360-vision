"""
httpx Executor - Web technology fingerprinting using projectdiscovery/httpx.
Used by Super Agents for attack surface scanning.
"""

import json
import re
import subprocess
from typing import Dict, Any, List, Tuple

from agent.executors.base import BaseExecutor

# ── JS Framework Fingerprinting Rules ────────────────────────
# Each tuple: (regex_pattern, technology_name)
JS_FRAMEWORK_FINGERPRINTS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r'__NEXT_DATA__', re.IGNORECASE), 'Next.js'),
    (re.compile(r'/_next/static/', re.IGNORECASE), 'Next.js'),
    (re.compile(r'data-reactroot|_reactRoot|__react|react-app', re.IGNORECASE), 'React'),
    (re.compile(r'react\.production\.min\.js|react-dom', re.IGNORECASE), 'React'),
    (re.compile(r'ng-version=|ng-app|ng-controller', re.IGNORECASE), 'Angular'),
    (re.compile(r'__NUXT__|__nuxt|nuxt\.js', re.IGNORECASE), 'Nuxt/Vue'),
    (re.compile(r'data-v-[a-f0-9]|id="__vue"|vue\.runtime', re.IGNORECASE), 'Vue.js'),
    (re.compile(r'__svelte|svelte-[a-z]|svelte\.dev', re.IGNORECASE), 'Svelte'),
    (re.compile(r'__remixContext|remix\.run', re.IGNORECASE), 'Remix/React'),
    (re.compile(r'gatsby', re.IGNORECASE), 'Gatsby/React'),
]


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
            if not all_ports:
                self.logger.info(f"[httpx] No open ports from nmap on {target}, skipping probe")
                return {
                    'data': {
                        'ip': ip,
                        'hostname': hostname or '',
                        'web_services': [],
                    }
                }
            ports = all_ports

        # Protection against "Argument list too long" - cap at 200 ports
        MAX_PORTS = 200
        if len(ports) > MAX_PORTS:
            self.logger.warning(
                f"[httpx] {len(ports)} ports exceeds limit of {MAX_PORTS}. "
                f"Using top web ports + discovered ports subset."
            )
            # Prioritize common web ports, then fill with discovered ones
            priority_ports = set(self.DEFAULT_HTTP_PORTS)
            remaining = [p for p in ports if p not in priority_ports]
            ports = sorted(priority_ports | set(remaining[:MAX_PORTS - len(priority_ports)]))

        port_str = ','.join(str(p) for p in ports)
        timeout = params.get('timeout', 60)

        self.logger.info(f"[httpx] Probing {target} ports={port_str}" + (f" (ip={ip})" if hostname else ""))

        # Cloud-aware: add realistic browser headers for CDN targets
        is_cdn = context.get('is_cdn', False)
        cdn_provider = context.get('provider', 'unknown')

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
            '-follow-redirects',
            '-include-response',
        ]

        if is_cdn:
            self.logger.info(f"[httpx] CDN mode ({cdn_provider}): injecting browser headers")
            cmd.extend([
                '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                '-H', 'Accept-Language: en-US,en;q=0.9',
                '-H', 'Upgrade-Insecure-Requests: 1',
                '-H', 'Connection: keep-alive',
            ])

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
            self.logger.info(f"[httpx] Timeout on {target}, returning empty results")
            return {
                'data': {
                    'ip': ip,
                    'hostname': hostname or '',
                    'web_services': [],
                }
            }
        except FileNotFoundError:
            return {'error': 'httpx not installed. Install from https://github.com/projectdiscovery/httpx'}
        except Exception as e:
            return {'error': f'httpx error: {str(e)}'}

    def _fingerprint_body(self, body: str) -> List[str]:
        """Detect JS frameworks from HTML response body via regex fingerprints."""
        detected = set()
        # Only scan first 100KB to avoid performance issues
        snippet = body[:102400]
        for pattern, tech_name in JS_FRAMEWORK_FINGERPRINTS:
            if pattern.search(snippet):
                detected.add(tech_name)
        # If Next.js detected, ensure React is also listed
        if 'Next.js' in detected or 'Remix/React' in detected or 'Gatsby/React' in detected:
            detected.add('React')
        return sorted(detected)

    def _parse_output(self, stdout: str) -> List[Dict[str, Any]]:
        """Parse httpx JSON lines output."""
        web_services = []
        for line in stdout.strip().split('\n'):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)

                # Existing tech from Wappalyzer
                technologies = list(entry.get('tech', []) or [])

                # Fingerprint body for JS frameworks
                body = entry.get('body', '') or entry.get('response', '') or ''
                if body:
                    body_techs = self._fingerprint_body(body)
                    for t in body_techs:
                        if t not in technologies:
                            technologies.append(t)

                service = {
                    'url': entry.get('url', ''),
                    'status_code': entry.get('status_code', 0),
                    'title': entry.get('title', ''),
                    'server': entry.get('webserver', ''),
                    'technologies': technologies,
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
