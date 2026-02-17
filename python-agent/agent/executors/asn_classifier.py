"""
ASN Classifier Executor - Identifies CDN/Cloud providers via WHOIS socket lookup.
Used as Phase 0 in the attack surface pipeline to adapt scan strategy.
Enriches with RDAP data (country, registrant org, abuse/tech emails, IP range).

Returns: {data: {ip, is_cdn, provider, asn, org, country, abuse_email, tech_email, ip_range}}
"""

import json
import re
import socket
import ssl
from typing import Dict, Any, Optional, Tuple
from urllib.request import urlopen, Request
from urllib.error import URLError

from agent.executors.base import BaseExecutor


# Known CDN/Cloud edge providers and their identifying keywords
CDN_KEYWORDS = {
    'cloudflare': ['cloudflare'],
    'akamai': ['akamai'],
    'fastly': ['fastly'],
    'aws_cloudfront': ['cloudfront'],
    'aws': ['amazon', 'aws', 'amzn'],
    'azure': ['microsoft', 'azure', 'msft'],
    'google_cloud': ['google cloud', 'google llc'],
    'incapsula': ['incapsula', 'imperva'],
    'sucuri': ['sucuri'],
    'stackpath': ['stackpath', 'highwinds'],
    'limelight': ['limelight', 'edgecast', 'verizon digital'],
    'ovh': ['ovh'],
}

# Providers that are true CDN edge nodes (vs generic cloud hosting)
CDN_EDGE_PROVIDERS = {
    'cloudflare', 'akamai', 'fastly', 'aws_cloudfront',
    'incapsula', 'sucuri', 'stackpath', 'limelight',
}

# WHOIS servers ordered by priority
WHOIS_SERVERS = [
    ('whois.arin.net', 'n '),      # ARIN - prefix "n " forces network lookup
    ('whois.ripe.net', ''),         # RIPE
    ('whois.apnic.net', ''),        # APNIC
]

# Referral patterns to follow redirects to the correct RIR
REFERRAL_PATTERNS = [
    r'ReferralServer:\s*whois://([^:/\s]+)',
    r'refer:\s*([^\s]+)',
]

# RDAP servers to try (IANA bootstrap first, then direct fallbacks)
RDAP_SERVERS = [
    'https://rdap.iana.org/ip/{}',
    'https://rdap.registro.br/ip/{}',
    'https://rdap.arin.net/registry/ip/{}',
    'https://rdap.db.ripe.net/ip/{}',
    'https://rdap.apnic.net/ip/{}',
]


class AsnClassifierExecutor(BaseExecutor):
    """Classify an IP by ASN/provider to determine optimal scan strategy."""

    def run(self, step, context):
        # type: (Dict[str, Any], Dict[str, Any]) -> Dict[str, Any]
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')

        if not ip:
            return {'error': 'IP address is required'}

        timeout = params.get('timeout', 10)

        self.logger.info("[asn_classifier] Looking up provider for %s", ip)

        provider, asn, org = self._whois_lookup(ip, timeout)

        is_cdn = provider in CDN_EDGE_PROVIDERS if provider else False

        # Enrich with RDAP data
        rdap = self._rdap_lookup(ip)

        self.logger.info(
            "[asn_classifier] %s -> provider=%s, is_cdn=%s, asn=%s, org=%s, country=%s",
            ip, provider or 'unknown', is_cdn, asn or '?', org or '?',
            rdap.get('country', '?')
        )

        result = {
            'data': {
                'ip': ip,
                'is_cdn': is_cdn,
                'provider': provider or 'unknown',
                'asn': asn or '',
                'org': org or '',
            }
        }

        # Merge RDAP fields (only non-empty values)
        for key in ('country', 'abuse_email', 'tech_email', 'ip_range'):
            val = rdap.get(key)
            if val:
                result['data'][key] = val

        # Use RDAP org as fallback if WHOIS org is empty
        if not result['data']['org'] and rdap.get('registrant_org'):
            result['data']['org'] = rdap['registrant_org']

        # Use RDAP autnum as fallback if WHOIS ASN is empty
        if not result['data']['asn'] and rdap.get('autnum'):
            result['data']['asn'] = rdap['autnum']

        return result

    # ──────────────── RDAP lookup ────────────────

    def _rdap_lookup(self, ip):
        # type: (str) -> Dict[str, str]
        """Query RDAP via HTTPS to enrich IP data. Returns dict with optional fields."""
        result = {}  # type: Dict[str, str]

        for url_template in RDAP_SERVERS:
            url = url_template.format(ip)
            try:
                self.logger.info("[asn_classifier] Trying RDAP: %s", url)
                ctx = ssl.create_default_context()
                req = Request(url, headers={'Accept': 'application/rdap+json'})
                resp = urlopen(req, timeout=5, context=ctx)

                # Follow redirects (IANA bootstrap returns 301/302)
                data = json.loads(resp.read().decode('utf-8', errors='replace'))

                result = self._parse_rdap(data)
                if result.get('country') or result.get('registrant_org'):
                    self.logger.info("[asn_classifier] RDAP success from %s", url)
                    return result

            except (URLError, OSError, json.JSONDecodeError, ValueError) as e:
                self.logger.debug("[asn_classifier] RDAP failed for %s: %s", url, str(e))
                continue
            except Exception as e:
                self.logger.debug("[asn_classifier] RDAP unexpected error for %s: %s", url, str(e))
                continue

        return result

    def _parse_rdap(self, data):
        # type: (Dict[str, Any]) -> Dict[str, str]
        """Extract useful fields from RDAP JSON response."""
        result = {}  # type: Dict[str, str]

        # Country (top-level field)
        if data.get('country'):
            result['country'] = data['country']

        # IP range
        start = data.get('startAddress')
        end = data.get('endAddress')
        if start and end:
            result['ip_range'] = '{} - {}'.format(start, end)

        # ASN from nicbr_autnum field
        autnum = data.get('nicbr_autnum')
        if autnum:
            result['autnum'] = 'AS{}'.format(autnum)

        # Parse entities for registrant, abuse, tech contacts
        for entity in data.get('entities', []):
            roles = [r.lower() for r in entity.get('roles', [])]
            vcard = self._extract_vcard(entity)

            if 'registrant' in roles:
                if vcard.get('fn'):
                    result['registrant_org'] = vcard['fn']

            if 'abuse' in roles:
                if vcard.get('email'):
                    result['abuse_email'] = vcard['email']

            if 'technical' in roles:
                if vcard.get('email'):
                    result['tech_email'] = vcard['email']

            # Some responses nest abuse+technical in same entity
            if 'abuse' in roles and 'technical' in roles:
                if vcard.get('email'):
                    result.setdefault('abuse_email', vcard['email'])
                    result.setdefault('tech_email', vcard['email'])

            # Check nested entities (LACNIC/BR often nests contacts inside registrant)
            for sub_entity in entity.get('entities', []):
                sub_roles = [r.lower() for r in sub_entity.get('roles', [])]
                sub_vcard = self._extract_vcard(sub_entity)

                if 'abuse' in sub_roles and sub_vcard.get('email'):
                    result.setdefault('abuse_email', sub_vcard['email'])
                if 'technical' in sub_roles and sub_vcard.get('email'):
                    result.setdefault('tech_email', sub_vcard['email'])
                if 'administrative' in sub_roles and sub_vcard.get('email'):
                    # Use admin email as fallback for tech
                    result.setdefault('tech_email', sub_vcard['email'])

        return result

    def _extract_vcard(self, entity):
        # type: (Dict[str, Any]) -> Dict[str, str]
        """Extract fn and email from jCard/vCard array."""
        result = {}  # type: Dict[str, str]
        vcard_array = entity.get('vcardArray')
        if not vcard_array or not isinstance(vcard_array, list) or len(vcard_array) < 2:
            return result

        for entry in vcard_array[1]:
            if not isinstance(entry, list) or len(entry) < 4:
                continue
            field_type = entry[0]
            value = entry[3]
            if field_type == 'fn' and isinstance(value, str):
                result['fn'] = value
            elif field_type == 'email' and isinstance(value, str):
                result['email'] = value

        return result

    # ──────────────── WHOIS lookup (existing) ────────────────

    def _whois_lookup(self, ip, timeout):
        # type: (str, int) -> Tuple[Optional[str], Optional[str], Optional[str]]
        """Query WHOIS via TCP socket, following referrals if needed."""

        # Try primary server (ARIN)
        server, prefix = WHOIS_SERVERS[0]
        query = prefix + ip
        output = self._query_whois_server(server, query, timeout)

        if not output:
            # Try fallback servers
            for server, prefix in WHOIS_SERVERS[1:]:
                query = prefix + ip
                output = self._query_whois_server(server, query, timeout)
                if output:
                    break

        if not output:
            self.logger.warning("[asn_classifier] All WHOIS servers failed for %s", ip)
            return None, None, None

        # Check for referral to another RIR
        referral_server = self._extract_referral(output)
        if referral_server:
            self.logger.info("[asn_classifier] Following referral to %s", referral_server)
            referral_output = self._query_whois_server(referral_server, ip, timeout)
            if referral_output:
                output = referral_output

        # Extract fields from response
        asn = self._extract_field(output, [
            r'origin(?:as)?:\s*(AS\d+)',
            r'aut-num:\s*(AS\d+)',
            r'OriginAS:\s*(AS\d+)',
        ])

        org = self._extract_field(output, [
            r'OrgName:\s*(.+)',
            r'org-name:\s*(.+)',
            r'Organisation:\s*(.+)',
            r'organization:\s*(.+)',
            r'descr:\s*(.+)',
            r'netname:\s*(.+)',
        ])

        provider = self._match_provider(output.lower())

        return provider, asn, org.strip() if org else None

    def _query_whois_server(self, server, query, timeout):
        # type: (str, str, int) -> Optional[str]
        """Send a WHOIS query via TCP socket and return the response text."""
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
            self.logger.warning("[asn_classifier] Socket timeout for %s (%ds)", server, timeout)
            return None
        except (socket.error, OSError) as e:
            self.logger.warning("[asn_classifier] Socket error for %s: %s", server, str(e))
            return None
        except Exception as e:
            self.logger.warning("[asn_classifier] Unexpected error for %s: %s", server, str(e))
            return None

    def _extract_referral(self, text):
        # type: (str) -> Optional[str]
        """Extract referral server from WHOIS response."""
        for pattern in REFERRAL_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(1).strip()
        return None

    def _extract_field(self, text, patterns):
        # type: (str, list) -> Optional[str]
        """Extract first matching field from whois output."""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(1).strip()
        return None

    def _match_provider(self, text_lower):
        # type: (str) -> Optional[str]
        """Match provider name from lowercase whois output."""
        for provider, keywords in CDN_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    return provider
        return None
