
# Fix: Token Expiration During Task Execution

## Step 1: Mark orphaned tasks as completed

Update the 4 stuck tasks via SQL (using the insert/update tool):

```sql
UPDATE attack_surface_tasks 
SET status = 'completed', completed_at = NOW()
WHERE id IN (
  '762fdae1-281f-4cb3-b193-2b0bdc078bd0',
  '36a95492-c753-4e5e-8f53-6f6009105ddf',
  'bb05b14b-c54f-4ab7-bcae-1282b19402c7',
  'aed245f4-6d81-4984-817c-612b41d56891'
);
```

Then update the snapshot to `completed`:

```sql
UPDATE attack_surface_snapshots
SET status = 'completed', completed_at = NOW()
WHERE id = '22e62639-be20-4291-8c6b-45ba827d24c0';
```

## Step 2: Root cause and fix

### Problem

The `APIClient.post()` raises `RuntimeError("TOKEN_EXPIRED")` and the callers handle it differently:

- **Heartbeat**: `main.py` catches `TOKEN_EXPIRED`, refreshes, and retries -- works fine
- **Step/Task results**: `_report_step_result()` catches the exception but only logs a warning -- data is lost. `report_result()` (line 736) does not catch at all, so it bubbles up to `process_all()` (line 756), which logs the error but moves to the next task without retrying

The agent already refreshes before processing tasks (line 131-133 of `main.py`), but attack surface scans can take 30+ minutes across many tasks, easily exceeding the 30-minute token lifetime.

### Solution: Auto-retry with token refresh in APIClient

Add retry logic directly in `APIClient.post()` so that when `TOKEN_EXPIRED` is received, it automatically refreshes the token and retries the request once. This fixes ALL callers (step results, task results, heartbeat) in one place.

### File: `python-agent/agent/api_client.py`

1. Add an `auth_manager` reference (set after construction since there's a circular dependency)
2. In `post()`, when the response contains `TOKEN_EXPIRED`, call `auth_manager.refresh_tokens()` and retry once

```python
class APIClient:
    def __init__(self, base_url, state, logger):
        self.base_url = base_url.rstrip("/")
        self.state = state
        self.logger = logger
        self._auth_manager = None  # Set after construction

    def set_auth_manager(self, auth_manager):
        """Set auth manager for automatic token refresh on TOKEN_EXPIRED."""
        self._auth_manager = auth_manager

    def post(self, path, json=None, use_refresh_token=False):
        # ... existing code ...
        if not response.ok:
            error_msg = self._extract_error(response)
            # Auto-retry on TOKEN_EXPIRED (once)
            if error_msg == "TOKEN_EXPIRED" and self._auth_manager and not use_refresh_token:
                self.logger.info(f"Token expirado em POST {path}, renovando e retentando...")
                self._auth_manager.refresh_tokens()
                # Retry with new token
                response = requests.post(
                    f"{self.base_url}{path}",
                    json=json,
                    headers=self._headers(),
                    timeout=60
                )
                if response.ok:
                    return response.json()
                error_msg = self._extract_error(response)
            self.logger.error(f"POST {path} -> {error_msg}")
            raise RuntimeError(error_msg)
        return response.json()
```

### File: `python-agent/main.py`

Wire the auth manager into the API client after construction:

```python
class AgentApp:
    def __init__(self, logger):
        # ... existing code ...
        self.api = APIClient(API_BASE_URL, self.state, logger)
        self.auth = AuthManager(self.state, self.api, logger)
        self.api.set_auth_manager(self.auth)  # Enable auto-retry
```

Same pattern for `get()` as well, for completeness.

### Why this approach

- **Single fix point**: All API calls automatically get retry-on-expired behavior
- **No changes to TaskExecutor**: The `_report_step_result` and `report_result` methods work as-is
- **No infinite loops**: The retry flag `use_refresh_token` prevents recursion on the refresh call itself
- **Backward compatible**: Existing heartbeat retry logic in `main.py` still works (it will just never trigger since APIClient handles it first)
