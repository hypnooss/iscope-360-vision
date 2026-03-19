

## Fix: Reset command timeout on new output

### Problem
The command timeout uses a fixed `start_time` (line 368) that never resets when output is received. For streaming commands like `tail -f`, the 120s timer always expires even though the command is actively producing output.

### Fix
**File**: `python-agent/supervisor/realtime_shell.py`, line ~389

When output is read from the PTY, reset `start_time` alongside `self._last_activity`:

```python
if data:
    self._last_activity = time.time()
    start_time = time.time()  # ← add this line
```

This ensures the 120s timeout only triggers after 120s of **silence**, not 120s total runtime.

### Result
- `tail -f` and other long-running commands will stay alive as long as they produce output
- Commands that hang silently will still be killed after 120s of no output

