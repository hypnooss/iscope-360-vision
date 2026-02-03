"""
Amass Executor - Subdomain enumeration using OWASP Amass.

Executes Amass in passive or active mode and returns discovered subdomains
with source information.
"""

import json
import os
import shutil
import subprocess
import tempfile
from typing import Any, Dict

from .base import BaseExecutor


class AmassExecutor(BaseExecutor):
    """Executor for subdomain enumeration using Amass."""

    DEFAULT_TIMEOUT = 300  # 5 minutes default
    MAX_TIMEOUT = 900      # 15 minutes max

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute Amass enumeration.

        Config options:
            domain: Target domain (required, can come from context)
            mode: 'passive' (default) or 'active'
            timeout: Max execution time in seconds (default: 300)
            max_depth: DNS brute force recursion depth (active mode only)

        Returns:
            Dict with:
                - domain: Target domain
                - subdomains: List of discovered subdomains with metadata
                - total_found: Number of unique subdomains
                - sources: List of data sources used
                - mode: Enumeration mode used
        """
        config = step.get('config', {}) or {}
        step_id = step.get('id', 'unknown')

        domain = (config.get('domain') or context.get('domain') or '').strip().rstrip('.')
        mode = config.get('mode', 'passive').lower()
        timeout = min(config.get('timeout', self.DEFAULT_TIMEOUT), self.MAX_TIMEOUT)
        max_depth = config.get('max_depth', 1)

        if not domain:
            return {'status_code': 0, 'data': None, 'error': 'Missing domain'}

        # Check if Amass is installed
        amass_path = shutil.which('amass')
        if not amass_path:
            self.logger.error(f"Step {step_id}: Amass not installed")
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': 'Amass not installed. Run agent installer with --update.'
            }

        self.logger.info(f"Step {step_id}: Running Amass ({mode}) for {domain}")

        # Create temp file for JSON output
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            output_file = f.name

        try:
            # Build command
            cmd = [
                amass_path,
                'enum',
                '-d', domain,
                '-json', output_file,
                '-timeout', str(int(timeout / 60)),  # Amass uses minutes
            ]

            if mode == 'passive':
                cmd.append('-passive')
            elif mode == 'active':
                cmd.extend(['-active', '-brute'])
                if max_depth > 1:
                    cmd.extend(['-max-depth', str(max_depth)])

            # Execute Amass
            self.logger.debug(f"Step {step_id}: Executing: {' '.join(cmd)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout + 30,  # Extra buffer
                cwd='/tmp'
            )

            if result.returncode != 0 and not os.path.exists(output_file):
                error_msg = result.stderr[:500] if result.stderr else f"Exit code: {result.returncode}"
                self.logger.error(f"Step {step_id}: Amass failed - {error_msg}")
                return {
                    'status_code': result.returncode,
                    'data': {'domain': domain, 'subdomains': []},
                    'error': f"Amass failed: {error_msg}"
                }

            # Parse JSON output (one JSON object per line)
            subdomains = []
            sources_set = set()

            if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                with open(output_file, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            entry = json.loads(line)
                            name = entry.get('name', '').lower()
                            if name and self._is_valid_subdomain(name, domain):
                                subdomain_entry = {
                                    'subdomain': name,
                                    'sources': entry.get('sources', []),
                                    'addresses': entry.get('addresses', []),
                                }
                                subdomains.append(subdomain_entry)
                                for src in entry.get('sources', []):
                                    sources_set.add(src)
                        except json.JSONDecodeError:
                            continue

            # Deduplicate by subdomain name
            seen = set()
            unique_subdomains = []
            for sub in subdomains:
                if sub['subdomain'] not in seen:
                    seen.add(sub['subdomain'])
                    unique_subdomains.append(sub)

            # Sort alphabetically
            unique_subdomains.sort(key=lambda x: x['subdomain'])

            self.logger.info(
                f"Step {step_id}: Amass found {len(unique_subdomains)} unique subdomains "
                f"from {len(sources_set)} sources"
            )

            return {
                'status_code': 200,
                'data': {
                    'domain': domain,
                    'mode': mode,
                    'total_found': len(unique_subdomains),
                    'sources': sorted(list(sources_set)),
                    'subdomains': unique_subdomains,
                },
                'error': None,
            }

        except subprocess.TimeoutExpired:
            self.logger.error(f"Step {step_id}: Amass timeout after {timeout}s")
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': f'Amass timeout after {timeout} seconds'
            }

        except Exception as e:
            self.logger.error(f"Step {step_id}: Amass error - {str(e)}")
            return {
                'status_code': 0,
                'data': {'domain': domain, 'subdomains': []},
                'error': str(e),
            }

        finally:
            # Cleanup temp file
            if os.path.exists(output_file):
                os.remove(output_file)

    def _is_valid_subdomain(self, name: str, base_domain: str) -> bool:
        """Check if name is a valid subdomain of base_domain."""
        name = name.lstrip('*.').lower()
        base_domain = base_domain.lower()
        if not name:
            return False
        return name == base_domain or name.endswith(f".{base_domain}")
