"""
Domain WHOIS Executor - Collects domain registration data.

Primary: RDAP via HTTPS (port 443) - works through corporate firewalls.
Fallback: WHOIS via TCP socket (port 43) - used when RDAP fails.

The Agent runs on-premise, bypassing cloud-IP blocks from registrars
like registro.br that return 403 for datacenter IPs.

Returns: {data: {domain, registrar, expires_at, created_at, owner, source, raw_text}}
"""

import json
import re
import socket
import ssl
from typing import Dict, Any, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

from agent.executors.base import BaseExecutor


# ---------------------------------------------------------------------------
# RDAP endpoints by TLD (longest suffix match wins)
# ---------------------------------------------------------------------------
RDAP_SERVERS = {
    '.br': 'https://rdap.registro.br/domain/{}',
    '.com': 'https://rdap.verisign.com/com/v1/domain/{}',
    '.net': 'https://rdap.verisign.com/net/v1/domain/{}',
    '.org': 'https://rdap.org/domain/{}',
    '.io': 'https://rdap.org/domain/{}',
    '.dev': 'https://rdap.org/domain/{}',
    '.app': 'https://rdap.org/domain/{}',
    '.services': 'https://rdap.org/domain/{}',
    '.cloud': 'https://rdap.org/domain/{}',
    '.info': 'https://rdap.org/domain/{}',
}

DEFAULT_RDAP = 'https://rdap.org/domain/{}'

# ---------------------------------------------------------------------------
# WHOIS servers for TCP fallback (port 43)
# ---------------------------------------------------------------------------
WHOIS_SERVERS = {
    '.br': 'whois.registro.br',
    '.com': 'whois.verisign-grs.com',
    '.net': 'whois.verisign-grs.com',
    '.org': 'whois.pir.org',
    '.io': 'whois.nic.io',
    '.dev': 'whois.nic.google',
    '.app': 'whois.nic.google',
    '.services': 'whois.donuts.co',
    '.cloud': 'whois.nic.google',
    '.info': 'whois.afilias.net',
}

DEFAULT_WHOIS_SERVER = 'whois.iana.org'

# ---------------------------------------------------------------------------
# Regex patterns for WHOIS text parsing (TCP fallback)
# ---------------------------------------------------------------------------
REGISTRAR_PATTERNS = [
    r'Registrar:\s*(.+)',
    r'registrar:\s*(.+)',
    r'Sponsoring Registrar:\s*(.+)',
    r'Registrar Name:\s*(.+)',
]

EXPIRES_PATTERNS = [
    r'Registry Expiry Date:\s*(\S+)',
    r'Expiration Date:\s*(\S+)',
    r'Registrar Registration Expiration Date:\s*(\S+)',
    r'expires:\s*(\S+)',
    r'paid-till:\s*(\S+)',
    r'Expiry Date:\s*(\S+)',
    r'expire:\s*(\S+)',
]

CREATED_PATTERNS = [
    r'Creation Date:\s*(\S+)',
    r'created:\s*(\S+)',
    r'Created Date:\s*(\S+)',
    r'Registration Date:\s*(\S+)',
    r'Domain Registration Date:\s*(\S+)',
]

OWNER_PATTERNS = [
    r'owner:\s*(.+)',
    r'Registrant Organization:\s*(.+)',
    r'Registrant Name:\s*(.+)',
    r'org:\s*(.+)',
]

REFERRAL_PATTERNS = [
    r'refer:\s*(\S+)',
    r'whois:\s*(\S+)',
    r'Registrar WHOIS Server:\s*(\S+)',
    r'ReferralServer:\s*whois://(\S+)',
]


class DomainWhoisExecutor(BaseExecutor):
    """Collect domain WHOIS data via RDAP/HTTPS (primary) or TCP socket (fallback)."""

    def run(self, step, context):
        # type: (Dict[str, Any], Dict[str, Any]) -> Dict[str, Any]
        params = step.get('params', {})
        config = step.get('config', {})

        domain = (
            params.get('domain')
            or context.get('domain')
            or (context.get('target', {}) or {}).get('domain')
        )

        if not domain:
            return {'error': 'Domain is required'}

        domain = domain.lower().strip()
        timeout = params.get('timeout', 15)

        self.logger.info("[domain_whois] Looking up WHOIS for %s", domain)

        # --- Try RDAP via HTTPS first (port 443) ---
        result = self._try_rdap(domain, config, timeout)

        # --- Fallback to TCP socket (port 43) ---
        if not result:
            self.logger.info("[domain_whois] RDAP failed, falling back to TCP socket")
            result = self._try_whois_tcp(domain, config, timeout)

        if not result:
            return {'error': 'All lookup methods failed for {}'.format(domain)}

        self.logger.info(
            "[domain_whois] %s -> registrar=%s, expires=%s, owner=%s (via %s)",
            domain,
            result.get('registrar') or 'unknown',
            result.get('expires_at') or 'unknown',
            result.get('owner') or 'unknown',
            result.get('source', '?'),
        )

        return {'data': result}

    # -----------------------------------------------------------------------
    # RDAP via HTTPS (primary method)
    # -----------------------------------------------------------------------

    def _try_rdap(self, domain, config, timeout):
        # type: (str, Dict[str, Any], int) -> Optional[Dict[str, Any]]
        """Query RDAP over HTTPS. Returns parsed dict or None on failure."""
        url = self._resolve_rdap_url(domain, config)
        self.logger.info("[domain_whois] RDAP query: %s", url)

        try:
            ctx = ssl.create_default_context()
            req = Request(url, headers={
                'Accept': 'application/rdap+json, application/json',
                'User-Agent': 'InfraScope360-Agent/1.0',
            })
            resp = urlopen(req, timeout=timeout, context=ctx)
            body = resp.read(65536).decode('utf-8', errors='replace')
            data = json.loads(body)

            return self._parse_rdap(domain, data, body)

        except HTTPError as e:
            self.logger.warning("[domain_whois] RDAP HTTP %d for %s", e.code, url)
            return None
        except (URLError, OSError) as e:
            self.logger.warning("[domain_whois] RDAP network error for %s: %s", url, str(e))
            return None
        except (json.JSONDecodeError, ValueError) as e:
            self.logger.warning("[domain_whois] RDAP parse error for %s: %s", url, str(e))
            return None
        except Exception as e:
            self.logger.warning("[domain_whois] RDAP unexpected error for %s: %s", url, str(e))
            return None

    def _resolve_rdap_url(self, domain, config):
        # type: (str, Dict[str, Any]) -> str
        """Find best RDAP endpoint by longest TLD suffix match."""
        servers = dict(RDAP_SERVERS)
        custom = config.get('rdap_servers', {})
        if isinstance(custom, dict):
            servers.update(custom)

        best_url = DEFAULT_RDAP
        best_len = 0
        for suffix, url_tpl in servers.items():
            if domain.endswith(suffix) and len(suffix) > best_len:
                best_url = url_tpl
                best_len = len(suffix)

        return best_url.format(domain)

    def _parse_rdap(self, domain, data, raw_body):
        # type: (str, Dict[str, Any], str) -> Optional[Dict[str, Any]]
        """Extract fields from RDAP JSON response."""
        registrar = None
        expires_at = None
        created_at = None
        owner = None

        # Extract events (expiration, registration)
        for event in data.get('events', []):
            action = event.get('eventAction', '')
            date = event.get('eventDate', '')
            if action == 'expiration' and date:
                expires_at = date
            elif action == 'registration' and date:
                created_at = date

        # Extract entities (registrar, registrant)
        for entity in data.get('entities', []):
            roles = entity.get('roles', [])
            handle = entity.get('handle', '')
            # Try vcardArray for name
            name = self._extract_vcard_name(entity)

            if 'registrar' in roles:
                registrar = name or handle or entity.get('publicIds', [{}])[0].get('identifier')
            if 'registrant' in roles:
                owner = name or handle

        # Fallback: some RDAP responses put registrar at top level
        if not registrar:
            for entity in data.get('entities', []):
                if entity.get('objectClassName') == 'entity':
                    name = self._extract_vcard_name(entity)
                    if name:
                        registrar = name
                        break

        if not expires_at and not created_at and not registrar:
            return None

        result = {
            'domain': domain,
            'registrar': registrar,
            'expires_at': expires_at,
            'created_at': created_at,
            'owner': owner,
            'source': 'rdap',
            'raw_text': raw_body[:4096] if raw_body else None,
        }
        return result

    def _extract_vcard_name(self, entity):
        # type: (Dict[str, Any]) -> Optional[str]
        """Extract organization or formatted name from vcardArray."""
        vcard = entity.get('vcardArray')
        if not vcard or not isinstance(vcard, list) or len(vcard) < 2:
            return None

        for field in vcard[1]:
            if not isinstance(field, list) or len(field) < 4:
                continue
            field_name = field[0]
            value = field[3]
            if field_name == 'fn' and isinstance(value, str) and value.strip():
                return value.strip()
            if field_name == 'org' and isinstance(value, str) and value.strip():
                return value.strip()

        return None

    # -----------------------------------------------------------------------
    # WHOIS via TCP socket (fallback)
    # -----------------------------------------------------------------------

    def _try_whois_tcp(self, domain, config, timeout):
        # type: (str, Dict[str, Any], int) -> Optional[Dict[str, Any]]
        """Query WHOIS via TCP socket on port 43. Returns parsed dict or None."""
        servers = dict(WHOIS_SERVERS)
        custom = config.get('whois_servers', {})
        if isinstance(custom, dict):
            servers.update(custom)

        whois_server = self._resolve_whois_server(domain, servers)
        self.logger.info("[domain_whois] TCP WHOIS via %s", whois_server)

        raw_text = self._query_whois(whois_server, domain, timeout)
        if not raw_text:
            return None

        # Follow referral if present
        referral = self._extract_field(raw_text, REFERRAL_PATTERNS)
        if referral and referral != whois_server:
            referral_host = referral.split(':')[0].strip()
            self.logger.info("[domain_whois] Following referral to %s", referral_host)
            referred_text = self._query_whois(referral_host, domain, timeout)
            if referred_text:
                raw_text = referred_text

        registrar = self._extract_field(raw_text, REGISTRAR_PATTERNS)
        expires_at = self._normalize_date(self._extract_field(raw_text, EXPIRES_PATTERNS))
        created_at = self._normalize_date(self._extract_field(raw_text, CREATED_PATTERNS))
        owner = self._extract_field(raw_text, OWNER_PATTERNS)

        if not registrar and not expires_at and not created_at:
            return None

        return {
            'domain': domain,
            'registrar': registrar,
            'expires_at': expires_at,
            'created_at': created_at,
            'owner': owner,
            'source': 'whois_tcp',
            'whois_server': whois_server,
            'raw_text': raw_text[:4096] if raw_text else None,
        }

    def _resolve_whois_server(self, domain, servers):
        # type: (str, Dict[str, str]) -> str
        best_server = servers.get('default', DEFAULT_WHOIS_SERVER)
        best_len = 0
        for suffix, server in servers.items():
            if suffix == 'default':
                continue
            if domain.endswith(suffix) and len(suffix) > best_len:
                best_server = server
                best_len = len(suffix)
        return best_server

    def _query_whois(self, server, query, timeout):
        # type: (str, str, int) -> Optional[str]
        try:
            sock = socket.create_connection((server, 43), timeout=timeout)
            try:
                sock.sendall((query + '\r\n').encode('utf-8'))
                chunks = []
                total = 0
                while total < 65536:
                    try:
                        chunk = sock.recv(4096)
                    except socket.timeout:
                        break
                    if not chunk:
                        break
                    chunks.append(chunk)
                    total += len(chunk)
                return b''.join(chunks).decode('utf-8', errors='replace')
            finally:
                sock.close()
        except (socket.timeout, socket.error, OSError) as e:
            self.logger.warning("[domain_whois] TCP error for %s: %s", server, str(e))
            return None
        except Exception as e:
            self.logger.warning("[domain_whois] TCP unexpected error for %s: %s", server, str(e))
            return None

    def _extract_field(self, text, patterns):
        # type: (str, list) -> Optional[str]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                val = match.group(1).strip()
                if val:
                    return val
        return None

    def _normalize_date(self, date_str):
        # type: (Optional[str]) -> Optional[str]
        if not date_str:
            return None
        if re.match(r'^\d{4}-\d{2}-\d{2}', date_str):
            return date_str
        m = re.match(r'^(\d{4})(\d{2})(\d{2})$', date_str)
        if m:
            return '{}-{}-{}'.format(m.group(1), m.group(2), m.group(3))
        m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', date_str)
        if m:
            return '{}-{}-{}'.format(m.group(3), m.group(2), m.group(1))
        return date_str
