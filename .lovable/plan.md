

# Fix: Retry on Transient HTTP Errors (502/503/504)

## Problem

The agent logs show multiple `502 Bad Gateway` errors from Cloudflare when posting step results to `/agent-step-result`. These are transient infrastructure errors (Supabase Edge Function cold starts, Cloudflare timeouts, or momentary overload).

Currently, the `APIClient` only retries on `TOKEN_EXPIRED`. For any other error (including 502/503/504), it immediately raises `RuntimeError`, and `_report_step_result` catches it but **silently loses the step data** (line 567: logs a warning and moves on).

This means:
- The step executed successfully (e.g., httpx found web services)
- But the result was never saved to the database
- The task shows as "completed" but with missing step data

## Solution

Add automatic retry with exponential backoff for transient HTTP errors (status codes 502, 503, 504, 429) in `APIClient.post()` and `APIClient.get()`.

## Technical Details

### File: `python-agent/agent/api_client.py`

1. Import `time` module
2. Add a constant `TRANSIENT_STATUS_CODES = {429, 502, 503, 504}`
3. Add a `MAX_RETRIES = 3` constant
4. Modify `get()` and `post()` to wrap the request in a retry loop:
   - On transient status codes, wait with exponential backoff (2s, 4s, 8s) and retry
   - On the last retry, fall through to the existing error handling
   - Log each retry attempt
   - The TOKEN_EXPIRED retry logic remains unchanged (applied after all transient retries are exhausted)

```text
Retry flow:
  POST /agent-step-result
    -> 502 Bad Gateway
    -> wait 2s, retry #1
    -> 502 Bad Gateway  
    -> wait 4s, retry #2
    -> 200 OK (success)
```

The retry applies to ALL API calls (step results, task results, heartbeat, task fetch), providing resilience across the board.

### No changes needed to `tasks.py`

Since the retry happens inside `APIClient`, the `_report_step_result` method and all other callers benefit automatically without any code changes.

### Implementation

```python
import time
import requests

class APIClient:
    TRANSIENT_STATUS_CODES = {429, 502, 503, 504}
    MAX_RETRIES = 3
    
    # ... existing __init__, set_auth_manager, _headers, _extract_error ...

    def get(self, path):
        self.logger.info(f"GET {path}")
        
        for attempt in range(self.MAX_RETRIES + 1):
            response = requests.get(
                f"{self.base_url}{path}",
                headers=self._headers(),
                timeout=10
            )
            
            if response.status_code in self.TRANSIENT_STATUS_CODES and attempt < self.MAX_RETRIES:
                wait = 2 ** (attempt + 1)  # 2, 4, 8 seconds
                self.logger.warning(f"GET {path} -> {response.status_code}, retry {attempt+1}/{self.MAX_RETRIES} in {wait}s")
                time.sleep(wait)
                continue
            break

        if not response.ok:
            error_msg = self._extract_error(response)
            # existing TOKEN_EXPIRED logic...
            ...

    def post(self, path, json=None, use_refresh_token=False):
        # Same pattern: wrap the request in a retry loop for transient errors
        ...
        for attempt in range(self.MAX_RETRIES + 1):
            response = requests.post(...)
            if response.status_code in self.TRANSIENT_STATUS_CODES and attempt < self.MAX_RETRIES:
                wait = 2 ** (attempt + 1)
                self.logger.warning(f"POST {path} -> {response.status_code}, retry {attempt+1}/{self.MAX_RETRIES} in {wait}s")
                time.sleep(wait)
                continue
            break
        
        # Then existing error handling (TOKEN_EXPIRED, etc.)
```

## Risk Assessment

- **Low risk**: Only adds wait-and-retry for well-known transient errors
- **No behavior change** for non-transient errors (401, 403, 404, 500 still fail immediately)
- **Bounded retries**: Max 3 retries with max ~14s total wait, won't stall the agent
- **429 included**: Handles rate limiting from Supabase/Cloudflare gracefully

