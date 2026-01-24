"""
HTTP Request Executor - Generic HTTP request executor for API calls.
Executes HTTP requests based on step configuration from blueprints.
"""

import re
from typing import Any, Dict, Optional

import requests
import urllib3

from .base import BaseExecutor

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class HTTPRequestExecutor(BaseExecutor):
    """Generic executor for HTTP requests."""

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an HTTP request based on step configuration.
        
        Args:
            step: Step configuration containing:
                - id: Step identifier
                - executor: 'http_request'
                - config: {
                    method: HTTP method (GET, POST, etc.)
                    path: URL path (can use {{variables}})
                    headers: Optional headers dict
                    body: Optional request body
                    verify_ssl: Whether to verify SSL (default: False)
                    timeout: Request timeout in seconds (default: 30)
                  }
            context: Execution context containing:
                - base_url: Base URL for the target
                - api_key: API key for authentication
                - username: Optional username
                - password: Optional password
                - Any other variables for interpolation
        
        Returns:
            Dict with status_code, data (parsed JSON), and error if any
        """
        config = step.get('config', {})
        step_id = step.get('id', 'unknown')
        
        method = config.get('method', 'GET').upper()
        path = config.get('path', '/')
        headers = config.get('headers', {})
        body = config.get('body')
        verify_ssl = config.get('verify_ssl', False)
        timeout = config.get('timeout', 30)
        
        # Get base URL
        base_url = context.get('base_url', '').rstrip('/')
        if not base_url:
            self.logger.error(f"Step {step_id}: No base_url in context")
            return {
                'status_code': 0,
                'data': None,
                'error': 'No base_url provided in context'
            }
        
        # Interpolate variables in path
        path = self._interpolate(path, context)
        
        # Interpolate variables in headers
        interpolated_headers = {}
        for key, value in headers.items():
            interpolated_headers[key] = self._interpolate(str(value), context)
        
        # Build full URL
        url = f"{base_url}{path}"
        
        self.logger.debug(f"Step {step_id}: {method} {url}")
        
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=interpolated_headers,
                json=body if body else None,
                verify=verify_ssl,
                timeout=timeout
            )
            
            # Try to parse JSON response
            try:
                data = response.json()
            except ValueError:
                data = {'raw_text': response.text[:1000]} if response.text else None
            
            if response.ok:
                self.logger.debug(f"Step {step_id}: Success ({response.status_code})")
                return {
                    'status_code': response.status_code,
                    'data': data,
                    'error': None
                }
            else:
                self.logger.warning(f"Step {step_id}: HTTP {response.status_code}")
                return {
                    'status_code': response.status_code,
                    'data': data,
                    'error': f"HTTP {response.status_code}: {response.reason}"
                }
                
        except requests.exceptions.Timeout:
            self.logger.error(f"Step {step_id}: Timeout after {timeout}s")
            return {
                'status_code': 0,
                'data': None,
                'error': f'Request timeout after {timeout} seconds'
            }
        except requests.exceptions.ConnectionError as e:
            self.logger.error(f"Step {step_id}: Connection error - {str(e)}")
            return {
                'status_code': 0,
                'data': None,
                'error': f'Connection error: {str(e)}'
            }
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Step {step_id}: Request error - {str(e)}")
            return {
                'status_code': 0,
                'data': None,
                'error': f'Request error: {str(e)}'
            }
        except Exception as e:
            self.logger.error(f"Step {step_id}: Unexpected error - {str(e)}")
            return {
                'status_code': 0,
                'data': None,
                'error': f'Unexpected error: {str(e)}'
            }

    def _interpolate(self, template: str, context: Dict[str, Any]) -> str:
        """
        Interpolate {{variable}} placeholders in a template string.
        
        Supports nested access like {{credentials.api_key}}.
        """
        def replace_match(match):
            var_path = match.group(1).strip()
            value = self._get_nested_value(context, var_path)
            return str(value) if value is not None else match.group(0)
        
        return re.sub(r'\{\{([^}]+)\}\}', replace_match, template)

    def _get_nested_value(self, obj: Dict[str, Any], path: str) -> Optional[Any]:
        """Get a nested value from a dict using dot notation."""
        keys = path.split('.')
        current = obj
        
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None
        
        return current
