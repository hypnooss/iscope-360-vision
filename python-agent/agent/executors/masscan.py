"""
Masscan Executor - Fast port discovery using masscan.
Used by Super Agents for attack surface scanning.
"""

import json
import subprocess
import re
from typing import Dict, Any

from agent.executors.base import BaseExecutor


class MasscanExecutor(BaseExecutor):
    """Execute masscan for rapid port discovery on a single IP."""

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        params = step.get('params', {})
        ip = params.get('ip') or context.get('ip')

        if not ip:
            return {'error': 'IP address is required'}

        port_range = params.get('port_range', '1-65535')
        rate = params.get('rate', 10000)
        timeout = params.get('timeout', 120)

        self.logger.info(f"[masscan] Scanning {ip} ports={port_range} rate={rate}")

        cmd = [
            'masscan', ip,
            f'-p{port_range}',
            f'--rate={rate}',
            '-oJ', '-',
            '--wait', '3',
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )

            raw_output = result.stdout.strip()
            stderr_output = result.stderr.strip() if result.stderr else ''

            if stderr_output:
                self.logger.warning(f"[masscan] stderr: {stderr_output[:500]}")

            if not raw_output:
                if result.returncode != 0:
                    error_msg = stderr_output or f'masscan exited with code {result.returncode}'
                    self.logger.error(f"[masscan] Failed on {ip}: {error_msg}")
                    return {'error': f'masscan failed: {error_msg}'}
                self.logger.info(f"[masscan] No open ports found on {ip}")
                return {'data': {'ip': ip, 'ports': []}}

            # masscan JSON output: array of objects with trailing comma issues
            # Clean up: remove trailing commas before ] and parse
            cleaned = re.sub(r',\s*\]', ']', raw_output)
            # Ensure it's wrapped in array
            if not cleaned.startswith('['):
                cleaned = f'[{cleaned}]'
            # Remove trailing comma at end before closing bracket
            cleaned = re.sub(r',\s*$', '', cleaned)
            if not cleaned.endswith(']'):
                cleaned += ']'

            try:
                entries = json.loads(cleaned)
            except json.JSONDecodeError:
                # Fallback: parse line by line
                entries = []
                for line in raw_output.split('\n'):
                    line = line.strip().rstrip(',')
                    if line.startswith('{'):
                        try:
                            entries.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue

            ports = sorted(set(
                entry['ports'][0]['port']
                for entry in entries
                if isinstance(entry, dict) and 'ports' in entry
            ))

            self.logger.info(f"[masscan] Found {len(ports)} open ports on {ip}: {ports[:20]}...")

            return {
                'data': {
                    'ip': ip,
                    'ports': ports,
                }
            }

        except subprocess.TimeoutExpired:
            return {'error': f'masscan timeout after {timeout}s on {ip}'}
        except FileNotFoundError:
            return {'error': 'masscan not installed. Run: apt install -y masscan'}
        except Exception as e:
            return {'error': f'masscan error: {str(e)}'}
