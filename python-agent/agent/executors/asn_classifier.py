"""
ASN Classifier Executor - Identifies CDN/Cloud providers via whois lookup.
Used as Phase 0 in the attack surface pipeline to adapt scan strategy.

Returns: {data: {ip, is_cdn, provider, asn, org}}
"""

import re
import subprocess
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
# Generic cloud (aws, azure, google_cloud, ovh) hosts real infrastructure
CDN_EDGE_PROVIDERS = {
    'cloudflare', 'akamai', 'fastly', 'aws_cloudfront',
    'incapsula', 'sucuri', 'stackpath', 'limelight',
}


class AsnClassifierExecutor(BaseExecutor):
    """Classify an IP by ASN/provider to determine optimal scan strategy."""

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')

        if not ip:
            return {'error': 'IP address is required'}

        timeout = params.get('timeout', 15)

        self.logger.info(f"[asn_classifier] Looking up provider for {ip}")

        provider, asn, org = self._whois_lookup(ip, timeout)

        is_cdn = provider in CDN_EDGE_PROVIDERS if provider else False

        self.logger.info(
            f"[asn_classifier] {ip} -> provider={provider or 'unknown'}, "
            f"is_cdn={is_cdn}, asn={asn or '?'}, org={org or '?'}"
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

    def _whois_lookup(self, ip: str, timeout: int) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Run whois and extract provider, ASN, and org name.
        
        Returns (provider, asn, org) or (None, None, None) on failure.
        """
        try:
            result = subprocess.run(
                ['whois', ip],
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            output = result.stdout.lower() if result.stdout else ''
            if not output:
                self.logger.warning(f"[asn_classifier] Empty whois output for {ip}")
                return None, None, None

            # Extract ASN
            asn = self._extract_field(result.stdout, [
                r'origin(?:as)?:\s*(AS\d+)',
                r'aut-num:\s*(AS\d+)',
                r'OriginAS:\s*(AS\d+)',
            ])

            # Extract org name
            org = self._extract_field(result.stdout, [
                r'OrgName:\s*(.+)',
                r'org-name:\s*(.+)',
                r'Organisation:\s*(.+)',
                r'organization:\s*(.+)',
                r'descr:\s*(.+)',
                r'netname:\s*(.+)',
            ])

            # Match provider by keywords against full output
            provider = self._match_provider(output)

            return provider, asn, org.strip() if org else None

        except subprocess.TimeoutExpired:
            self.logger.warning(f"[asn_classifier] whois timeout for {ip} ({timeout}s)")
            return None, None, None
        except FileNotFoundError:
            self.logger.error("[asn_classifier] whois not installed")
            return None, None, None
        except Exception as e:
            self.logger.warning(f"[asn_classifier] whois error for {ip}: {str(e)}")
            return None, None, None

    def _extract_field(self, text: str, patterns: list) -> Optional[str]:
        """Extract first matching field from whois output."""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(1).strip()
        return None

    def _match_provider(self, text_lower: str) -> Optional[str]:
        """Match provider name from lowercase whois output."""
        for provider, keywords in CDN_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    return provider
        return None
