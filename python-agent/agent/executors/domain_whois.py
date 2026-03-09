"""
Domain WHOIS Executor - Queries WHOIS servers via TCP socket (port 43).

Resolves the issue where cloud-based RDAP lookups are blocked (403) by
registrars like registro.br. Running from the on-premise Agent bypasses
these IP-based blocks.

Returns: {data: {domain, registrar, expires_at, created_at, owner, raw_text}}
"""

import re
import socket
from typing import Dict, Any, Optional

from agent.executors.base import BaseExecutor


# WHOIS servers by TLD suffix (longest match wins)
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

# Patterns to extract WHOIS fields (order matters — first match wins)
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

# Referral patterns (IANA and some registries redirect)
REFERRAL_PATTERNS = [
    r'refer:\s*(\S+)',
    r'whois:\s*(\S+)',
    r'Registrar WHOIS Server:\s*(\S+)',
    r'ReferralServer:\s*whois://(\S+)',
]


class DomainWhoisExecutor(BaseExecutor):
    """Query domain WHOIS data via TCP socket on port 43."""

    def run(self, step, context):
        # type: (Dict[str, Any], Dict[str, Any]) -> Dict[str, Any]
        params = step.get('params', {})
        config = step.get('config', {})

        # Get domain from params, context target, or payload
        domain = (
            params.get('domain')
            or context.get('domain')
            or (context.get('target', {}) or {}).get('domain')
        )

        if not domain:
            return {'error': 'Domain is required'}

        domain = domain.lower().strip()
        timeout = params.get('timeout', 15)

        # Merge custom WHOIS servers from config
        servers = dict(WHOIS_SERVERS)
        custom = config.get('whois_servers', {})
        if isinstance(custom, dict):
            servers.update(custom)

        self.logger.info("[domain_whois] Looking up WHOIS for %s", domain)

        # Determine WHOIS server (longest suffix match)
        whois_server = self._resolve_server(domain, servers)
        self.logger.info("[domain_whois] Using server: %s", whois_server)

        # Query WHOIS
        raw_text = self._query_whois(whois_server, domain, timeout)
        if not raw_text:
            return {'error': 'Failed to query WHOIS server {}'.format(whois_server)}

        # Check for referral and follow it
        referral = self._extract_field(raw_text, REFERRAL_PATTERNS)
        if referral and referral != whois_server:
            # Clean referral (remove port if present)
            referral_host = referral.split(':')[0].strip()
            self.logger.info("[domain_whois] Following referral to %s", referral_host)
            referred_text = self._query_whois(referral_host, domain, timeout)
            if referred_text:
                raw_text = referred_text

        # Extract fields
        registrar = self._extract_field(raw_text, REGISTRAR_PATTERNS)
        expires_at = self._extract_field(raw_text, EXPIRES_PATTERNS)
        created_at = self._extract_field(raw_text, CREATED_PATTERNS)
        owner = self._extract_field(raw_text, OWNER_PATTERNS)

        # Normalize dates (some formats: 20251231 or 2025-12-31T00:00:00Z)
        expires_at = self._normalize_date(expires_at)
        created_at = self._normalize_date(created_at)

        result = {
            'domain': domain,
            'registrar': registrar,
            'expires_at': expires_at,
            'created_at': created_at,
            'owner': owner,
            'whois_server': whois_server,
        }

        # Include truncated raw text for debugging (max 4KB)
        result['raw_text'] = raw_text[:4096] if raw_text else None

        self.logger.info(
            "[domain_whois] %s -> registrar=%s, expires=%s, owner=%s",
            domain,
            registrar or 'unknown',
            expires_at or 'unknown',
            owner or 'unknown',
        )

        return {'data': result}

    def _resolve_server(self, domain, servers):
        # type: (str, Dict[str, str]) -> str
        """Find the best WHOIS server by longest TLD suffix match."""
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
        """Send WHOIS query via TCP socket and return response text."""
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

        except socket.timeout:
            self.logger.warning("[domain_whois] Socket timeout for %s (%ds)", server, timeout)
            return None
        except (socket.error, OSError) as e:
            self.logger.warning("[domain_whois] Socket error for %s: %s", server, str(e))
            return None
        except Exception as e:
            self.logger.warning("[domain_whois] Unexpected error for %s: %s", server, str(e))
            return None

    def _extract_field(self, text, patterns):
        # type: (str, list) -> Optional[str]
        """Extract first matching field from WHOIS output."""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                val = match.group(1).strip()
                if val:
                    return val
        return None

    def _normalize_date(self, date_str):
        # type: (Optional[str]) -> Optional[str]
        """Normalize date to ISO format if possible."""
        if not date_str:
            return None

        # Already ISO-ish (2025-12-31T00:00:00Z or 2025-12-31)
        if re.match(r'^\d{4}-\d{2}-\d{2}', date_str):
            return date_str

        # YYYYMMDD format (registro.br uses this)
        m = re.match(r'^(\d{4})(\d{2})(\d{2})$', date_str)
        if m:
            return '{}-{}-{}'.format(m.group(1), m.group(2), m.group(3))

        # DD/MM/YYYY format
        m = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', date_str)
        if m:
            return '{}-{}-{}'.format(m.group(3), m.group(2), m.group(1))

        return date_str
