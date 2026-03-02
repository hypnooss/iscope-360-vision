

## Root Cause: Invisible Characters in PowerShell Output

The pipe works perfectly. Both `---ISCOPE_PIPE_TEST---` and `---ISCOPE_SESSION_READY---` arrive, but `line.strip() == marker` fails because `.NET` on Linux prepends invisible characters — most likely a UTF-8 BOM (`\ufeff`) on the first write, or ANSI escape sequences from PowerShell.

The marker ends up in the `lines` list (not matched), the 120s timeout fires, and the code reports failure even though connection succeeded.

## Fix: `python-agent/agent/executors/powershell.py`

### 1. Sanitize lines before comparison in `_read_until_marker`

Strip BOM, null bytes, ANSI escape codes, and other non-printable characters before comparing:

```python
import re

# Add as class constant
ANSI_ESCAPE_RE = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07')

def _sanitize_line(self, line: str) -> str:
    """Remove BOM, ANSI escapes, null bytes and other invisible chars."""
    line = line.replace('\ufeff', '')   # UTF-8 BOM
    line = line.replace('\x00', '')     # Null bytes
    line = self.ANSI_ESCAPE_RE.sub('', line)  # ANSI escape sequences
    return line.strip()
```

### 2. Use `_sanitize_line` in `_read_until_marker`

```python
def _read_until_marker(self, read_queue, marker, timeout):
    lines = []
    deadline = time.time() + timeout
    while True:
        remaining = deadline - time.time()
        if remaining <= 0:
            return (False, "\n".join(lines))
        try:
            line = read_queue.get(timeout=remaining)
        except queue.Empty:
            return (False, "\n".join(lines))
        if line is None:
            return (False, "\n".join(lines))
        line_clean = self._sanitize_line(line)
        if line_clean == marker:
            return (True, "\n".join(lines))
        lines.append(line_clean)
```

### 3. Add raw byte logging in reader thread for diagnostics

Log the raw `repr()` of each line at DEBUG level so we can see exactly what characters arrive:

```python
def _reader():
    try:
        for line in iter(stdout.readline, ''):
            self.logger.debug(f"[PS stdout raw] {repr(line)}")
            q.put(line)
    except Exception as e:
        self.logger.warning(f"Reader thread error: {e}")
    q.put(None)
```

### Summary

| Change | Purpose |
|--------|---------|
| `_sanitize_line()` method | Strip BOM, ANSI codes, null bytes |
| `_read_until_marker` uses sanitized comparison | Markers match regardless of invisible chars |
| Reader thread logs `repr(line)` | Shows exact bytes for future diagnostics |

