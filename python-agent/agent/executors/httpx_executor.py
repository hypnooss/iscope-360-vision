"""
httpx Executor - Web technology fingerprinting using projectdiscovery/httpx.
Used by Super Agents for attack surface scanning.
"""

import json
import re
import subprocess
import ssl
import urllib.request
from typing import Dict, Any, List, Tuple, Optional
from urllib.parse import urljoin

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

# ── Regex to extract script URLs from HTML ────────────────────
SCRIPT_SRC_RE = re.compile(r'<script[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)

# ── Generic pattern to capture ALL /_next/static/ JS files ────
NEXT_STATIC_JS_RE = re.compile(r'/_next/static/[^"\'>\s]+\.js', re.IGNORECASE)

# ── Version patterns to search in JS chunks ──────────────────
# React version: appears as "18.2.0" near "react" references in framework chunks
REACT_VERSION_PATTERNS = [
    # Turbopack/App Router: react-dom before, version after
    re.compile(r'react[.-]?dom[^{]*?version="(\d+\.\d+\.\d+)"', re.IGNORECASE),
    re.compile(r'react[.-]?dom[^{]*?version:"(\d+\.\d+\.\d+)"', re.IGNORECASE),
    re.compile(r'react[.-]dom\.production[^"]*?"(\d+\.\d+\.\d+)"'),
    re.compile(r'"react"[^}]*?"(\d+\.\d+\.\d+)"'),
    re.compile(r'ReactDOM[^"]*?version["\s:=]+["\'](\d+\.\d+\.\d+)'),
    re.compile(r'react@(\d+\.\d+\.\d+)'),
    # Common pattern in webpack bundled React
    re.compile(r'["\'](\d+\.\d+\.\d+)["\'][^}]*?react'),
    # Minified patterns common in App Router builds
    re.compile(r'\.version="(\d+\.\d+\.\d+)"[^}]*?react', re.IGNORECASE),
    re.compile(r'version:"(\d+\.\d+\.\d+)"[^}]*?react', re.IGNORECASE),
    # Broader: version string near ReactDOM in minified code
    re.compile(r'ReactDOM[^{]*?"(\d+\.\d+\.\d+)"'),
]

# Next.js version patterns
NEXTJS_VERSION_PATTERNS = [
    # Turbopack/App Router: next before, version after
    re.compile(r'next[^{]*?version="(\d+\.\d+\.\d+)"', re.IGNORECASE),
    re.compile(r'next[^{]*?version:"(\d+\.\d+\.\d+)"', re.IGNORECASE),
    re.compile(r'Next\.js["\s:=]+["\']?(\d+\.\d+\.\d+)'),
    re.compile(r'next@(\d+\.\d+\.\d+)'),
    re.compile(r'next[/:](\d+\.\d+\.\d+)'),
    re.compile(r'"next"[^}]*?"(\d+\.\d+\.\d+)"'),
    # Minified patterns
    re.compile(r'\.version="(\d+\.\d+\.\d+)"[^}]*?next', re.IGNORECASE),
    re.compile(r'version:"(\d+\.\d+\.\d+)"[^}]*?next', re.IGNORECASE),
]

# Pages Router chunk patterns (used for classification priority)
PAGES_ROUTER_CHUNK_PATTERNS = [
    (re.compile(r'framework-[a-f0-9]+\.js'), 'framework'),
    (re.compile(r'turbopack-[a-f0-9]+\.js'), 'turbopack'),
    (re.compile(r'main-[a-f0-9]+\.js'), 'main'),
    (re.compile(r'webpack-[a-f0-9]+\.js'), 'webpack'),
    (re.compile(r'pages/_app-[a-f0-9]+\.js'), 'app'),
]

# Max bytes to read from each JS chunk
MAX_CHUNK_BYTES = 51200  # 50KB
MAX_PROBE_REQUESTS = 15
PROBE_TIMEOUT = 5


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

    # ── Version probing ──────────────────────────────────────────

    def _extract_chunk_urls(self, body: str, base_url: str) -> List[Tuple[str, str]]:
        """Extract JS chunk URLs from HTML and classify them.
        
        Supports both Pages Router (framework-*.js) and App Router (generic hashes).
        Returns list of (full_url, chunk_type) where chunk_type is
        'framework', 'main', 'webpack', 'app', or 'generic'.
        """
        chunk_urls = []
        seen = set()
        snippet = body[:102400]

        # Extract ALL /_next/static/*.js URLs from HTML
        for match in NEXT_STATIC_JS_RE.finditer(snippet):
            src = match.group(0)
            full_url = urljoin(base_url, src) if not src.startswith('http') else src
            if full_url in seen:
                continue
            seen.add(full_url)

            # Classify: check Pages Router named patterns first
            chunk_type = 'generic'
            for pattern, ctype in PAGES_ROUTER_CHUNK_PATTERNS:
                if pattern.search(src):
                    chunk_type = ctype
                    break

            chunk_urls.append((full_url, chunk_type))

        # Sort: framework first, then main/webpack/app, then generic
        priority = {'framework': 0, 'main': 1, 'webpack': 2, 'app': 3, 'generic': 5, 'turbopack': 5}
        chunk_urls.sort(key=lambda x: priority.get(x[1], 99))

        self.logger.info(
            f"[httpx] Found {len(chunk_urls)} Next.js chunk URLs "
            f"({sum(1 for _, t in chunk_urls if t != 'generic')} named, "
            f"{sum(1 for _, t in chunk_urls if t == 'generic')} generic)"
        )

        return chunk_urls

    def _fetch_chunk(self, url: str, max_bytes: int = MAX_CHUNK_BYTES) -> Optional[str]:
        """Fetch first max_bytes of a URL (JS chunk or HTML page)."""
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            })
            with urllib.request.urlopen(req, timeout=PROBE_TIMEOUT, context=ctx) as resp:
                return resp.read(max_bytes).decode('utf-8', errors='ignore')
        except Exception as e:
            self.logger.debug(f"[httpx] Failed to fetch chunk {url}: {e}")
            return None

    def _probe_versions(self, base_url: str, body: str) -> Dict[str, str]:
        """Probe JS chunks to extract React and Next.js version numbers.
        
        Returns dict like {'React': '18.2.0', 'Next.js': '14.2.3'}.
        """
        versions: Dict[str, str] = {}

        # 1. Check __NEXT_DATA__ JSON for Next.js version (sometimes present)
        next_data_match = re.search(
            r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.*?)</script>',
            body[:102400], re.DOTALL
        )
        if next_data_match:
            try:
                next_data = json.loads(next_data_match.group(1))
                # Some builds expose runtimeConfig or buildId
                njs_ver = next_data.get('nextExport') or next_data.get('version')
                if njs_ver and re.match(r'\d+\.\d+\.\d+', str(njs_ver)):
                    versions['Next.js'] = str(njs_ver)
            except (json.JSONDecodeError, AttributeError):
                pass

        # 2. Extract chunk URLs from HTML
        chunk_urls = self._extract_chunk_urls(body, base_url)
        
        if not chunk_urls:
            self.logger.debug(f"[httpx] No chunk URLs found in HTML for {base_url}")
            return versions

        # Prioritize: framework (React version) > main/webpack (Next.js version) > generic
        probes_done = 0
        turbopack_detected = False
        for url, chunk_type in chunk_urls:
            if probes_done >= MAX_PROBE_REQUESTS:
                break
            # Skip named chunks if we already have what they'd give us
            if chunk_type == 'framework' and 'React' in versions:
                continue
            if chunk_type in ('main', 'webpack', 'app') and 'Next.js' in versions:
                continue
            # Skip generic chunks only if we have BOTH versions
            if chunk_type == 'generic' and 'React' in versions and 'Next.js' in versions:
                continue

            self.logger.info(f"[httpx] Probing {chunk_type} chunk: {url}")
            content = self._fetch_chunk(url)
            probes_done += 1

            if not content:
                continue

            # Track Turbopack signature for fallback inference
            if 'TURBOPACK' in content or 'globalThis.TURBOPACK' in content:
                turbopack_detected = True

            # Search for React version in any chunk
            if 'React' not in versions:
                for pattern in REACT_VERSION_PATTERNS:
                    m = pattern.search(content)
                    if m:
                        versions['React'] = m.group(1)
                        self.logger.info(f"[httpx] Detected React {m.group(1)} from {chunk_type} chunk")
                        break

            # Search for Next.js version in any chunk
            if 'Next.js' not in versions:
                for pattern in NEXTJS_VERSION_PATTERNS:
                    m = pattern.search(content)
                    if m:
                        versions['Next.js'] = m.group(1)
                        self.logger.info(f"[httpx] Detected Next.js {m.group(1)} from {chunk_type} chunk")
                        break

            # Debug: log preview of chunks without matches
            if 'React' not in versions and 'Next.js' not in versions:
                self.logger.debug(f"[httpx] No version in {chunk_type} chunk, preview: {content[:200]}")

            if versions.get('React') and versions.get('Next.js'):
                break  # Got both, no need for more probes

        # Fallback: Turbopack production builds strip versions
        # Turbopack is stable only in Next.js 15+, which requires React 19+
        if turbopack_detected or 'TURBOPACK' in (body or ''):
            if 'Next.js' not in versions:
                versions['Next.js'] = '15+'
                self.logger.info("[httpx] Turbopack detected → inferred Next.js 15+")
            if 'React' not in versions:
                versions['React'] = '19+'
                self.logger.info("[httpx] Turbopack detected → inferred React 19+")

        return versions

    # ── Fingerprinting ───────────────────────────────────────────

    def _fingerprint_body(self, body: str) -> List[str]:
        """Detect JS frameworks from HTML response body via regex fingerprints."""
        detected = set()
        snippet = body[:102400]
        for pattern, tech_name in JS_FRAMEWORK_FINGERPRINTS:
            if pattern.search(snippet):
                detected.add(tech_name)
        # If Next.js detected, ensure React is also listed
        if 'Next.js' in detected or 'Remix/React' in detected or 'Gatsby/React' in detected:
            detected.add('React')
        return sorted(detected)

    def _apply_versions(self, technologies: List[str], versions: Dict[str, str]) -> List[str]:
        """Replace bare tech names with versioned strings when versions are available.
        
        E.g., ['Next.js', 'React'] + {'React': '18.2.0', 'Next.js': '14.2.3'}
            → ['Next.js 14.2.3', 'React 18.2.0']
        """
        result = []
        for tech in technologies:
            if tech in versions:
                result.append(f"{tech} {versions[tech]}")
            else:
                result.append(tech)
        return result

    # ── Output parsing ───────────────────────────────────────────

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
                base_url = entry.get('url', '')
                
                if body:
                    self.logger.info(f"[httpx] Got response body ({len(body)} bytes) for {base_url}")
                    body_techs = self._fingerprint_body(body)
                    for t in body_techs:
                        if t not in technologies:
                            technologies.append(t)

                    # Probe for versions when Next.js or React detected
                    has_nextjs = any('Next.js' in t for t in technologies)
                    has_react = any('React' in t for t in technologies)
                    
                    if (has_nextjs or has_react) and base_url:
                        try:
                            versions = self._probe_versions(base_url, body)
                            if versions:
                                technologies = self._apply_versions(technologies, versions)
                                self.logger.info(
                                    f"[httpx] Version probe results for {base_url}: {versions}"
                                )
                        except Exception as e:
                            self.logger.warning(f"[httpx] Version probe failed for {base_url}: {e}")
                else:
                    self.logger.warning(f"[httpx] No response body in httpx output for {base_url}")

                # ── Fallback: fetch page ourselves when body is empty ──
                # Wappalyzer tech-detect works independently of body,
                # so we may have framework names but no body to probe versions from.
                if not body:
                    has_nextjs_fb = any('Next.js' in t for t in technologies)
                    has_react_fb = any('React' in t for t in technologies)

                    if (has_nextjs_fb or has_react_fb) and base_url:
                        self.logger.info(
                            f"[httpx] Body empty but Wappalyzer detected frameworks "
                            f"({', '.join(t for t in technologies if 'Next' in t or 'React' in t)}), "
                            f"fetching {base_url} manually"
                        )
                        fetched_body = self._fetch_chunk(base_url, max_bytes=102400)
                        if fetched_body:
                            self.logger.info(f"[httpx] Fallback fetched {len(fetched_body)} bytes from {base_url}")
                            # Fingerprint the fetched body too
                            fb_techs = self._fingerprint_body(fetched_body)
                            for t in fb_techs:
                                if t not in technologies:
                                    technologies.append(t)
                            try:
                                versions = self._probe_versions(base_url, fetched_body)
                                if versions:
                                    technologies = self._apply_versions(technologies, versions)
                                    self.logger.info(f"[httpx] Fallback version probe results for {base_url}: {versions}")
                            except Exception as e:
                                self.logger.warning(f"[httpx] Fallback version probe failed for {base_url}: {e}")
                        else:
                            self.logger.warning(f"[httpx] Fallback fetch failed for {base_url}")

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
