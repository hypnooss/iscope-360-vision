"""
DNS Query Executor - Performs DNS lookups and returns structured data.

Supported query_type values:
- NS
- MX
- SOA
- SPF   (TXT filtered by v=spf1)
- DMARC (TXT at _dmarc.<domain>)
- DKIM  (TXT at <selector>._domainkey.<domain> for each selector)
- DNSSEC (best-effort: DNSKEY + DS presence)
"""

from __future__ import annotations

import base64
from typing import Any, Dict, List, Optional

from .base import BaseExecutor


class DNSQueryExecutor(BaseExecutor):
    DEFAULT_TIMEOUT_S = 4.0

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        config = step.get('config', {}) or {}
        step_id = step.get('id', 'unknown')
        query_type = str(config.get('query_type', '')).upper().strip()
        domain = (config.get('domain') or context.get('domain') or '').strip().rstrip('.')
        selectors = config.get('selectors') or []
        best_effort = bool(config.get('best_effort', True))
        timeout = float(config.get('timeout', self.DEFAULT_TIMEOUT_S))

        if not query_type:
            return { 'status_code': 0, 'data': None, 'error': 'Missing query_type' }
        if not domain:
            return { 'status_code': 0, 'data': None, 'error': 'Missing domain' }

        try:
            import dns.resolver  # type: ignore
        except Exception as e:
            self.logger.error(f"Step {step_id}: dnspython not available: {str(e)}")
            return { 'status_code': 0, 'data': None, 'error': 'dnspython not installed' }

        resolver = dns.resolver.Resolver(configure=True)
        resolver.lifetime = timeout
        resolver.timeout = timeout

        try:
            if query_type == 'NS':
                answers = resolver.resolve(domain, 'NS')
                records = [{'host': str(r.target).rstrip('.')} for r in answers]
                return {
                    'status_code': 0,
                    'data': {'query_type': 'NS', 'domain': domain, 'records': records},
                    'error': None,
                }

            if query_type == 'MX':
                answers = resolver.resolve(domain, 'MX')
                records: List[Dict[str, Any]] = []

                for r in answers:
                    exchange = str(r.exchange).rstrip('.')
                    resolved: List[str] = []

                    # Best-effort: resolve A/AAAA behind MX exchange (alias/provedor gerenciado)
                    try:
                        ips: set[str] = set()
                        for rrtype in ['A', 'AAAA']:
                            try:
                                ip_answers = resolver.resolve(exchange, rrtype)
                                for ip in ip_answers:
                                    ips.add(str(ip))
                            except Exception:
                                # ignore A/AAAA lookup failures (timeout/NXDOMAIN/etc)
                                pass
                        resolved = sorted(list(ips))
                    except Exception:
                        resolved = []

                    records.append({
                        'priority': int(r.preference),
                        'exchange': exchange,
                        'resolved_ips': resolved,
                        'resolved_ip_count': len(resolved),
                    })
                records.sort(key=lambda x: x['priority'])
                return {
                    'status_code': 0,
                    'data': {'query_type': 'MX', 'domain': domain, 'records': records},
                    'error': None,
                }

            if query_type == 'SOA':
                answers = resolver.resolve(domain, 'SOA')
                r = answers[0]
                rname = str(r.rname).rstrip('.')
                contact_email = self._soa_rname_to_email(rname)
                return {
                    'status_code': 0,
                    'data': {
                        'query_type': 'SOA',
                        'domain': domain,
                        'mname': str(r.mname).rstrip('.'),
                        'rname': rname,
                        'contact_email': contact_email,
                        'serial': int(r.serial),
                        'refresh': int(r.refresh),
                        'retry': int(r.retry),
                        'expire': int(r.expire),
                        'minimum': int(r.minimum),
                    },
                    'error': None,
                }

            if query_type == 'SPF':
                txts = self._get_txt_records(resolver, domain)
                spf = next((t for t in txts if t.lower().startswith('v=spf1')), None)
                parsed = self._parse_spf(spf) if spf else None
                return {
                    'status_code': 0,
                    'data': {
                        'query_type': 'SPF',
                        'domain': domain,
                        'raw': spf,
                        'parsed': parsed,
                    },
                    'error': None,
                }

            if query_type == 'DMARC':
                dmarc_name = f"_dmarc.{domain}".rstrip('.')
                txts = self._get_txt_records(resolver, dmarc_name)
                raw = next((t for t in txts if 'v=dmarc1' in t.lower()), None)
                parsed = self._parse_dmarc(raw) if raw else None
                return {
                    'status_code': 0,
                    'data': {
                        'query_type': 'DMARC',
                        'domain': domain,
                        'name': dmarc_name,
                        'raw': raw,
                        'parsed': parsed,
                    },
                    'error': None,
                }

            if query_type == 'DKIM':
                # selectors may come as a JSON array or comma-separated string
                if isinstance(selectors, str):
                    selectors_list = [s.strip() for s in selectors.split(',') if s.strip()]
                elif isinstance(selectors, list):
                    selectors_list = [str(s).strip() for s in selectors if str(s).strip()]
                else:
                    selectors_list = []

                found: List[Dict[str, Any]] = []
                missing = 0

                for sel in selectors_list:
                    name = f"{sel}._domainkey.{domain}".rstrip('.')
                    try:
                        txts = self._get_txt_records(resolver, name)
                        dkim_txt = next((t for t in txts if 'v=dkim1' in t.lower()), None)
                        if not dkim_txt:
                            missing += 1
                            continue
                        parsed = self._parse_dkim(dkim_txt)
                        found.append({
                            'selector': sel,
                            'name': name,
                            'txt_raw': self._truncate(dkim_txt, 600),
                            **parsed,
                        })
                    except Exception:
                        missing += 1

                return {
                    'status_code': 0,
                    'data': {
                        'query_type': 'DKIM',
                        'domain': domain,
                        'checked_count': len(selectors_list),
                        'missing_count': missing,
                        'found': found,
                    },
                    'error': None,
                }

            if query_type == 'DNSSEC':
                notes: List[str] = []
                has_dnskey = False
                has_ds = False

                try:
                    answers = resolver.resolve(domain, 'DNSKEY')
                    has_dnskey = len(list(answers)) > 0
                except Exception as e:
                    notes.append(f"DNSKEY: {self._err_short(e)}")

                try:
                    answers = resolver.resolve(domain, 'DS')
                    has_ds = len(list(answers)) > 0
                except Exception as e:
                    # DS usually lives at parent zone; resolver may still return data depending on setup.
                    notes.append(f"DS: {self._err_short(e)}")

                validated: Any = 'unknown'
                if has_dnskey and has_ds:
                    validated = 'partial' if best_effort else 'unknown'

                return {
                    'status_code': 0,
                    'data': {
                        'query_type': 'DNSSEC',
                        'domain': domain,
                        'has_dnskey': has_dnskey,
                        'has_ds': has_ds,
                        'validated': validated,
                        'notes': notes,
                    },
                    'error': None,
                }

            return {
                'status_code': 0,
                'data': {'query_type': query_type, 'domain': domain},
                'error': f"Unsupported query_type: {query_type}",
            }

        except Exception as e:
            self.logger.error(f"Step {step_id}: DNS query error ({query_type} {domain}) - {str(e)}")
            return {
                'status_code': 0,
                'data': {'query_type': query_type, 'domain': domain},
                'error': str(e),
            }

    def _get_txt_records(self, resolver, name: str) -> List[str]:
        answers = resolver.resolve(name, 'TXT')
        out: List[str] = []
        for r in answers:
            # dnspython returns bytes chunks; join them
            parts = []
            for s in getattr(r, 'strings', []) or []:
                try:
                    parts.append(s.decode('utf-8', errors='replace'))
                except Exception:
                    parts.append(str(s))
            if parts:
                out.append(''.join(parts))
            else:
                out.append(str(r).strip('"'))
        return out

    def _soa_rname_to_email(self, rname: str) -> Optional[str]:
        # RFC: rname is a domain name with first '.' representing '@'
        # Example: hostmaster.example.com. => hostmaster@example.com
        if not rname:
            return None
        if '.' not in rname:
            return None
        first, rest = rname.split('.', 1)
        if not rest:
            return None
        return f"{first}@{rest.rstrip('.')}"

    def _parse_spf(self, raw: Optional[str]) -> Optional[Dict[str, Any]]:
        if not raw:
            return None
        tokens = [t.strip() for t in raw.split() if t.strip()]
        if not tokens or tokens[0].lower() != 'v=spf1':
            return None

        parsed: Dict[str, Any] = {
            'mechanisms': [],
            'includes': [],
            'ip4': [],
            'ip6': [],
            'a': [],
            'mx': [],
            'exists': [],
            'redirect': None,
            'all': None,
        }

        for tok in tokens[1:]:
            if tok.startswith('include:'):
                parsed['includes'].append(tok.split(':', 1)[1])
            elif tok.startswith('ip4:'):
                parsed['ip4'].append(tok.split(':', 1)[1])
            elif tok.startswith('ip6:'):
                parsed['ip6'].append(tok.split(':', 1)[1])
            elif tok.startswith('a'):
                parsed['a'].append(tok)
            elif tok.startswith('mx'):
                parsed['mx'].append(tok)
            elif tok.startswith('exists:'):
                parsed['exists'].append(tok.split(':', 1)[1])
            elif tok.startswith('redirect='):
                parsed['redirect'] = tok.split('=', 1)[1]
            elif tok.endswith('all'):
                # ~all, -all, +all, ?all
                parsed['all'] = tok
            else:
                parsed['mechanisms'].append(tok)

        return parsed

    def _parse_dmarc(self, raw: Optional[str]) -> Optional[Dict[str, Any]]:
        if not raw:
            return None
        tags = [t.strip() for t in raw.split(';') if t.strip()]
        out: Dict[str, Any] = {}
        for tag in tags:
            if '=' not in tag:
                continue
            k, v = tag.split('=', 1)
            out[k.strip().lower()] = v.strip()
        return out if out else None

    def _parse_dkim(self, raw: str) -> Dict[str, Any]:
        # Example: v=DKIM1; k=rsa; p=...
        tags = [t.strip() for t in raw.split(';') if t.strip()]
        kv: Dict[str, str] = {}
        for tag in tags:
            if '=' in tag:
                k, v = tag.split('=', 1)
                kv[k.strip().lower()] = v.strip()

        p = kv.get('p', '')
        key_type = kv.get('k')
        flags = kv.get('t')
        key_size_bits = self._estimate_key_bits_from_p(p) if p else None

        return {
            'key_type': key_type,
            'flags': flags,
            'p_length': len(p) if p else 0,
            'key_size_bits': key_size_bits,
        }

    def _estimate_key_bits_from_p(self, p_value: str) -> Optional[int]:
        try:
            # Best-effort approximation: decoded bytes length * 8
            raw = base64.b64decode(p_value + '===', validate=False)
            if not raw:
                return None
            return len(raw) * 8
        except Exception:
            return None

    def _truncate(self, s: str, max_len: int) -> str:
        if len(s) <= max_len:
            return s
        return s[: max_len - 3] + '...'

    def _err_short(self, e: Exception) -> str:
        msg = str(e) or e.__class__.__name__
        return self._truncate(msg, 180)
