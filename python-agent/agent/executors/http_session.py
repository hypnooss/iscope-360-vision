"""
HTTP Session Executor - Executor for session-based APIs (like SonicWall).
Manages cookies and authentication state across multiple steps.
"""

import re
from typing import Any, Dict, Optional

import requests
import urllib3

from .base import BaseExecutor

# Disable SSL warnings for self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class HTTPSessionExecutor(BaseExecutor):
    """
    Executor for APIs that use session-based authentication with cookies.
    
    Unlike HTTPRequestExecutor, this executor maintains a requests.Session()
    that persists cookies across multiple steps. This is required for APIs
    like SonicWall that use login/logout flows instead of static API keys.
    
    Step actions:
        - 'login': Authenticate with Basic Auth and store session cookies
        - 'request': Execute a request using the stored session
        - 'logout': End the session and clean up
    """

    def __init__(self, logger):
        super().__init__(logger)
        self._sessions: Dict[str, requests.Session] = {}

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an HTTP session step.
        
        Args:
            step: Step configuration containing:
                - id: Step identifier
                - executor: 'http_session'
                - config: {
                    action: 'login' | 'request' | 'logout'
                    method: HTTP method (GET, POST, DELETE, etc.)
                    path: URL path
                    headers: Optional headers dict
                    body: Optional request body
                    basic_auth: Whether to use Basic Auth for this step
                    verify_ssl: Whether to verify SSL (default: False)
                    timeout: Request timeout in seconds (default: 30)
                  }
            context: Execution context containing:
                - base_url: Base URL for the target
                - username: Username for Basic Auth
                - password: Password for Basic Auth
                - session_id: (injected) Session identifier for multi-step flows
        
        Returns:
            Dict with status_code, data (parsed JSON), error if any,
            and session_data for login steps
        """
        config = step.get('config', {})
        step_id = step.get('id', 'unknown')
        action = config.get('action', 'request')
        
        if action == 'login':
            return self._do_login(step_id, config, context)
        elif action == 'logout':
            return self._do_logout(step_id, config, context)
        else:
            return self._do_request(step_id, config, context)

    def _get_session_key(self, context: Dict[str, Any]) -> str:
        """Generate a unique session key based on the target."""
        base_url = context.get('base_url', '')
        return f"session_{hash(base_url)}"

    def _do_login(self, step_id: str, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Authenticate with the target and store session cookies.
        """
        method = config.get('method', 'POST').upper()
        path = config.get('path', '/api/sonicos/auth')
        headers = config.get('headers', {})
        verify_ssl = config.get('verify_ssl', False)
        timeout = config.get('timeout', 30)
        
        base_url = context.get('base_url', '').rstrip('/')
        if not base_url:
            self.logger.error(f"Step {step_id}: No base_url in context")
            return {
                'status_code': 0,
                'data': None,
                'error': 'No base_url provided in context'
            }
        
        # Get credentials
        username = context.get('username') or context.get('credentials', {}).get('username')
        password = context.get('password') or context.get('credentials', {}).get('password')
        
        if not username or not password:
            self.logger.error(f"Step {step_id}: No username/password in context")
            return {
                'status_code': 0,
                'data': None,
                'error': 'No username/password provided for session authentication'
            }
        
        # Interpolate variables
        path = self._interpolate(path, context)
        interpolated_headers = {k: self._interpolate(str(v), context) for k, v in headers.items()}
        
        url = f"{base_url}{path}"
        session_key = self._get_session_key(context)
        
        # Create new session
        session = requests.Session()
        self._sessions[session_key] = session
        
        self.logger.info(f"Step {step_id}: Authenticating to {base_url}")
        
        try:
            response = session.request(
                method=method,
                url=url,
                headers=interpolated_headers,
                auth=(username, password),
                verify=verify_ssl,
                timeout=timeout
            )
            
            # Parse response
            try:
                data = response.json()
            except ValueError:
                data = {'raw_text': response.text[:1000]} if response.text else None
            
            if response.ok:
                self.logger.info(f"Step {step_id}: Login successful, session established")
                return {
                    'status_code': response.status_code,
                    'data': data,
                    'error': None,
                    'session_data': {
                        '_session_key': session_key,
                        '_session_active': True,
                    }
                }
            else:
                self.logger.error(f"Step {step_id}: Login failed ({response.status_code})")
                # Clean up failed session
                del self._sessions[session_key]
                return {
                    'status_code': response.status_code,
                    'data': data,
                    'error': f"Authentication failed: HTTP {response.status_code}"
                }
                
        except requests.exceptions.Timeout:
            self.logger.error(f"Step {step_id}: Timeout during login")
            if session_key in self._sessions:
                del self._sessions[session_key]
            return {
                'status_code': 0,
                'data': None,
                'error': f'Login timeout after {timeout} seconds'
            }
        except requests.exceptions.ConnectionError as e:
            self.logger.error(f"Step {step_id}: Connection error - {str(e)}")
            if session_key in self._sessions:
                del self._sessions[session_key]
            return {
                'status_code': 0,
                'data': None,
                'error': f'Connection error: {str(e)}'
            }
        except Exception as e:
            self.logger.error(f"Step {step_id}: Unexpected error - {str(e)}")
            if session_key in self._sessions:
                del self._sessions[session_key]
            return {
                'status_code': 0,
                'data': None,
                'error': f'Unexpected error: {str(e)}'
            }

    def _do_request(self, step_id: str, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a request using the established session.
        """
        method = config.get('method', 'GET').upper()
        path = config.get('path', '/')
        headers = config.get('headers', {})
        body = config.get('body')
        verify_ssl = config.get('verify_ssl', False)
        timeout = config.get('timeout', 30)
        
        base_url = context.get('base_url', '').rstrip('/')
        if not base_url:
            return {
                'status_code': 0,
                'data': None,
                'error': 'No base_url provided in context'
            }
        
        session_key = context.get('_session_key') or self._get_session_key(context)
        session = self._sessions.get(session_key)
        
        if not session:
            self.logger.error(f"Step {step_id}: No active session found")
            return {
                'status_code': 0,
                'data': None,
                'error': 'No active session. Login step must be executed first.'
            }
        
        # Interpolate variables
        path = self._interpolate(path, context)
        interpolated_headers = {k: self._interpolate(str(v), context) for k, v in headers.items()}
        
        url = f"{base_url}{path}"
        
        self.logger.debug(f"Step {step_id}: {method} {url}")
        
        try:
            response = session.request(
                method=method,
                url=url,
                headers=interpolated_headers,
                json=body if body else None,
                verify=verify_ssl,
                timeout=timeout
            )
            
            # Parse response
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
        except Exception as e:
            self.logger.error(f"Step {step_id}: Unexpected error - {str(e)}")
            return {
                'status_code': 0,
                'data': None,
                'error': f'Unexpected error: {str(e)}'
            }

    def _do_logout(self, step_id: str, config: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        End the session and clean up.
        """
        method = config.get('method', 'DELETE').upper()
        path = config.get('path', '/api/sonicos/auth')
        headers = config.get('headers', {})
        verify_ssl = config.get('verify_ssl', False)
        timeout = config.get('timeout', 30)
        
        base_url = context.get('base_url', '').rstrip('/')
        session_key = context.get('_session_key') or self._get_session_key(context)
        session = self._sessions.get(session_key)
        
        if not session:
            self.logger.warning(f"Step {step_id}: No active session to logout")
            return {
                'status_code': 0,
                'data': None,
                'error': None  # Not an error, just no session to close
            }
        
        # Interpolate variables
        path = self._interpolate(path, context)
        interpolated_headers = {k: self._interpolate(str(v), context) for k, v in headers.items()}
        
        url = f"{base_url}{path}"
        
        self.logger.info(f"Step {step_id}: Logging out from {base_url}")
        
        try:
            response = session.request(
                method=method,
                url=url,
                headers=interpolated_headers,
                verify=verify_ssl,
                timeout=timeout
            )
            
            # Parse response
            try:
                data = response.json()
            except ValueError:
                data = {'raw_text': response.text[:500]} if response.text else None
            
            # Clean up session regardless of response
            del self._sessions[session_key]
            
            if response.ok:
                self.logger.info(f"Step {step_id}: Logout successful")
                return {
                    'status_code': response.status_code,
                    'data': data,
                    'error': None,
                    'session_data': {
                        '_session_key': None,
                        '_session_active': False,
                    }
                }
            else:
                self.logger.warning(f"Step {step_id}: Logout returned {response.status_code}")
                return {
                    'status_code': response.status_code,
                    'data': data,
                    'error': f"Logout returned HTTP {response.status_code} (session closed locally)"
                }
                
        except Exception as e:
            self.logger.error(f"Step {step_id}: Logout error - {str(e)}")
            # Clean up session on error too
            if session_key in self._sessions:
                del self._sessions[session_key]
            return {
                'status_code': 0,
                'data': None,
                'error': f'Logout error: {str(e)} (session closed locally)'
            }

    def _interpolate(self, template: str, context: Dict[str, Any]) -> str:
        """Interpolate {{variable}} placeholders in a template string."""
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
