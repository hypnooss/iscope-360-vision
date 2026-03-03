

## Fix: PowerShell WARNING lines breaking JSON parsing

**Root cause**: `exo_message_trace` emits a PowerShell WARNING (`\x1b[33;1mWARNING: There are more results...`) before the actual JSON result. The `_parse_interactive_result` method calls `json.loads(json_output.strip())` on the full block between `CMD_START` and `CMD_END`, which includes both the warning text and the JSON — causing `Expecting value: line 1 column 1`.

**File**: `python-agent/agent/executors/powershell.py`, method `_parse_interactive_result` (line 693-720)

**Fix**: When `json.loads` fails on the full output, scan individual lines for a valid JSON object before giving up. This handles any non-JSON output (warnings, verbose messages) that PowerShell injects before the payload.

```python
def _parse_interactive_result(self, cmd_name, json_output):
    text = json_output.strip()
    
    # Try full output first
    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        # Fallback: find first line that is valid JSON
        result = None
        for line in text.splitlines():
            line = line.strip()
            if not line or not (line.startswith('{') or line.startswith('[')):
                continue
            try:
                result = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
        if result is None:
            return ('failed', None, f"Invalid JSON output: no parseable JSON found in {len(text)} chars")
    
    # ... rest of parsing unchanged
```

This is a Python-only change — no frontend or edge function changes needed.

