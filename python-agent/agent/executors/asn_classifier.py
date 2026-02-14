"""
ASN Classifier Executor - Identifies CDN/Cloud providers via WHOIS socket lookup.
Used as Phase 0 in the attack surface pipeline to adapt scan strategy.

Returns: {data: {ip, is_cdn, provider, asn, org}}
"""

import re
import socket
from typing import Dict, Any, Optional, Tuple

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

        self.logger.info(
            "[asn_classifier] %s -> provider=%s, is_cdn=%s, asn=%s, org=%s",
            ip, provider or 'unknown', is_cdn, asn or '?', org or '?'
        )

        return {
            'data': {
                'ip': ip,
                'is_cdn': is_cdn,
                'provider': provider or 'unknown',
                'asn': asn or '',
                'org': org or '',
            }
        }

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
