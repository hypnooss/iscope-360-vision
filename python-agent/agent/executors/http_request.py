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
    """Generic executor for HTTP requests with automatic pagination for FortiGate memory logs."""

    # Pattern to detect FortiGate memory log endpoints eligible for pagination
    _MEMORY_LOG_PATTERN = re.compile(r'/api/v2/log/memory/')
    _ROWS_PATTERN = re.compile(r'[?&]rows=(\d+)')
    _START_PATTERN = re.compile(r'([?&])start=\d+')

    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an HTTP request based on step configuration.
        Automatically paginates FortiGate /api/v2/log/memory/ endpoints.
        """
        config = step.get('config', {})
        step_id = step.get('id', 'unknown')
        
        method = config.get('method', 'GET').upper()
        headers = config.get('headers', {})
        body = config.get('body')
        verify_ssl = config.get('verify_ssl', False)
        timeout = config.get('timeout', 30)

        # Interpolate variables in headers
        interpolated_headers = {}
        for key, value in headers.items():
            interpolated_headers[key] = self._interpolate(str(value), context)

        # Build URL: prioritize absolute 'url' in config over base_url + path
        absolute_url = config.get('url')
        if absolute_url:
            url = self._interpolate(absolute_url, context)
        else:
            base_url = context.get('base_url', '').rstrip('/')
            if not base_url:
                self.logger.error(f"Step {step_id}: No base_url in context")
                return {
                    'status_code': 0,
                    'data': None,
                    'error': 'No base_url provided in context'
                }
            path = config.get('path', '/')
            path = self._interpolate(path, context)
            url = f"{base_url}{path}"
        
        # Auto-pagination for FortiGate memory log endpoints
        if method == 'GET' and self._is_paginatable(url):
            return self._paginated_request(
                step_id, url, interpolated_headers, config, context,
                verify_ssl=verify_ssl, timeout=timeout
            )
        
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

    def _is_paginatable(self, url: str) -> bool:
        """Check if a URL is a FortiGate memory log endpoint with rows parameter."""
        return bool(self._MEMORY_LOG_PATTERN.search(url) and self._ROWS_PATTERN.search(url))

    def _paginated_request(
        self, step_id: str, url: str, headers: Dict[str, str],
        config: Dict[str, Any], context: Dict[str, Any],
        verify_ssl: bool = False, timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Fetch all pages from a FortiGate memory log endpoint.
        
        Stops when:
        - Page returns fewer results than `rows` (partial_page)
        - Page is empty (empty_page)
        - Oldest log in page is older than period_start (period_cutoff)
        - Max pages reached (max_pages safety limit)
        """
        rows_match = self._ROWS_PATTERN.search(url)
        rows = int(rows_match.group(1)) if rows_match else 500
        max_pages = config.get('max_pages', 20)
        period_start = context.get('period_start')

        all_results = []
        current_start = 0
        stopped_by = 'max_pages'
        pages_fetched = 0
        last_status_code = 200

        self.logger.info(
            f"Step {step_id}: Starting paginated collection (rows={rows}, max_pages={max_pages}, "
            f"period_start={period_start or 'none'})"
        )

        for page in range(max_pages):
            # Build paged URL: replace or add start parameter
            if self._START_PATTERN.search(url):
                paged_url = self._START_PATTERN.sub(
                    lambda m: f"{m.group(1)}start={current_start}", url
                )
            elif '?' in url:
                paged_url = f"{url}&start={current_start}"
            else:
                paged_url = f"{url}?start={current_start}"

            self.logger.debug(f"Step {step_id}: Page {page + 1} - GET {paged_url}")

            try:
                response = requests.request(
                    method='GET',
                    url=paged_url,
                    headers=headers,
                    verify=verify_ssl,
                    timeout=timeout
                )
                last_status_code = response.status_code

                if not response.ok:
                    self.logger.warning(
                        f"Step {step_id}: Page {page + 1} returned HTTP {response.status_code}"
                    )
                    if page == 0:
                        # First page failed - return error
                        try:
                            data = response.json()
                        except ValueError:
                            data = {'raw_text': response.text[:1000]} if response.text else None
                        return {
                            'status_code': response.status_code,
                            'data': data,
                            'error': f"HTTP {response.status_code}: {response.reason}"
                        }
                    # Subsequent page failed - stop with what we have
                    stopped_by = 'http_error'
                    break

                try:
                    data = response.json()
                except ValueError:
                    self.logger.warning(f"Step {step_id}: Page {page + 1} non-JSON response")
                    stopped_by = 'parse_error'
                    break

                results = data.get('results', [])
                pages_fetched += 1

                if not results:
                    stopped_by = 'empty_page'
                    self.logger.debug(f"Step {step_id}: Page {page + 1} empty - stopping")
                    break

                all_results.extend(results)

                # Check period_start cutoff
                if period_start and results:
                    oldest_log = results[-1]  # FortiGate returns newest first
                    oldest_date = oldest_log.get('date', '')
                    oldest_time = oldest_log.get('time', '')
                    if oldest_date and oldest_time:
                        oldest_ts = f"{oldest_date}T{oldest_time}"
                    elif oldest_date:
                        oldest_ts = oldest_date
                    else:
                        oldest_ts = oldest_log.get('eventtime', '')
                    
                    if oldest_ts and oldest_ts < period_start:
                        stopped_by = 'period_cutoff'
                        self.logger.debug(
                            f"Step {step_id}: Page {page + 1} oldest log ({oldest_ts}) "
                            f"< period_start ({period_start}) - stopping"
                        )
                        break

                if len(results) < rows:
                    stopped_by = 'partial_page'
                    self.logger.debug(
                        f"Step {step_id}: Page {page + 1} partial ({len(results)}/{rows}) - stopping"
                    )
                    break

                current_start += rows

            except requests.exceptions.Timeout:
                self.logger.error(f"Step {step_id}: Page {page + 1} timeout after {timeout}s")
                if page == 0:
                    return {
                        'status_code': 0,
                        'data': None,
                        'error': f'Request timeout after {timeout} seconds'
                    }
                stopped_by = 'timeout'
                break
            except requests.exceptions.ConnectionError as e:
                self.logger.error(f"Step {step_id}: Page {page + 1} connection error - {str(e)}")
                if page == 0:
                    return {
                        'status_code': 0,
                        'data': None,
                        'error': f'Connection error: {str(e)}'
                    }
                stopped_by = 'connection_error'
                break
            except Exception as e:
                self.logger.error(f"Step {step_id}: Page {page + 1} unexpected error - {str(e)}")
                if page == 0:
                    return {
                        'status_code': 0,
                        'data': None,
                        'error': f'Unexpected error: {str(e)}'
                    }
                stopped_by = 'error'
                break

        pagination_meta = {
            'pages_fetched': pages_fetched,
            'total_records': len(all_results),
            'stopped_by': stopped_by,
            'rows_per_page': rows,
        }

        self.logger.info(
            f"Step {step_id}: Pagination complete - {len(all_results)} records "
            f"in {pages_fetched} pages (stopped_by={stopped_by})"
        )

        return {
            'status_code': last_status_code,
            'data': {
                'results': all_results,
                '_pagination': pagination_meta,
            },
            'error': None
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
