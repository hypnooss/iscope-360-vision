

## Diagnosis: Commands Hang Because CMD_START Is Written AFTER Execution

The logs now reveal the exact problem thanks to `repr()` logging:

1. **Session connects fine** — both markers detected correctly
2. **Zero `[PS raw]` lines appear during 120s of command execution** — PowerShell produces NO output at all
3. The reason: `CMD_START_MARKER` is written **after** the command runs, not before

```text
Current command wrapper:
  $__data = (Get-AcceptedDomain | ConvertTo-Json ...)   ← HANGS HERE
  [Console]::WriteLine("---ISCOPE_CMD_START---")         ← never reached
  Write-Output (json)
  [Console]::WriteLine("---ISCOPE_CMD_END---")           ← never reached
```

If the Exchange cmdlet blocks (e.g., stale session, implicit auth prompt, network timeout), `CMD_START_MARKER` is never emitted, and the agent sees silence for 120s.

Additionally, the ANSI regex `\x1b\[[0-9;]*[a-zA-Z]` does **not** match `\x1b[?1h` (DEC private mode set/reset). These sequences survive sanitization. The `in` operator compensates for markers, but they pollute JSON output lines too.

## Fixes in `python-agent/agent/executors/powershell.py`

### 1. Fix ANSI regex to match DEC private mode sequences

```python
ANSI_ESCAPE_RE = re.compile(r'\x1b\[[\x20-\x3f]*[0-9;]*[\x20-\x7e]|\x1b\].*?\x07')
```

This covers `\x1b[?1h`, `\x1b[?1l`, and all other CSI sequences per ECMA-48.

### 2. Move CMD_START_MARKER before command execution

```python
def _build_interactive_command(self, cmd_name, cmd_text):
    return (
        f'[Console]::WriteLine("{self.CMD_START_MARKER}")\n'
        f"[Console]::Out.Flush()\n"
        f"try {{\n"
        f"    $__data = ({cmd_text} | ConvertTo-Json -Depth 10 -Compress)\n"
        f"    Write-Output (@{{ 'name'='{cmd_name}'; 'success'=$true; 'data'=$__data }} | ConvertTo-Json -Compress)\n"
        f"}} catch {{\n"
        f"    Write-Output (@{{ 'name'='{cmd_name}'; 'success'=$false; 'error'=$_.Exception.Message }} | ConvertTo-Json -Compress)\n"
        f"}}\n"
        f'[Console]::WriteLine("{self.CMD_END_MARKER}")\n'
        f"[Console]::Out.Flush()\n"
    )
```

This way:
- `CMD_START` confirms the command was received and PowerShell is executing
- If the cmdlet hangs, we'll still see `CMD_START` in the logs, and timeout means the cmdlet itself is stuck
- `CMD_END` is emitted outside the try/catch, so it always fires after the command (success or error)

### 3. Update `run_interactive` to match the new marker flow

The current code reads `CMD_START` first, then `CMD_END`. With `CMD_START` now emitted before execution, the flow remains the same but timeouts on `CMD_END` (not `CMD_START`) will indicate a hanging cmdlet. The reading logic stays identical — no changes needed there.

### 4. Add PowerShell-side timeout wrapper for Exchange cmdlets

Since Exchange cmdlets may genuinely hang (network issues, implicit auth), add a PowerShell-level timeout using `Start-Job` + `Wait-Job`:

```python
def _build_interactive_command(self, cmd_name, cmd_text, timeout=90):
    return (
        f'[Console]::WriteLine("{self.CMD_START_MARKER}")\n'
        f"[Console]::Out.Flush()\n"
        f"try {{\n"
        f"    $__job = Start-Job -ScriptBlock {{ {cmd_text} }}\n"
        f"    $__done = Wait-Job $__job -Timeout {timeout}\n"
        f"    if ($__done) {{\n"
        f"        $__data = (Receive-Job $__job | ConvertTo-Json -Depth 10 -Compress)\n"
        f"        Write-Output (@{{ 'name'='{cmd_name}'; 'success'=$true; 'data'=$__data }} | ConvertTo-Json -Compress)\n"
        f"    }} else {{\n"
        f"        Stop-Job $__job -ErrorAction SilentlyContinue\n"
        f"        Write-Output (@{{ 'name'='{cmd_name}'; 'success'=$false; 'error'='Command timed out after {timeout}s' }} | ConvertTo-Json -Compress)\n"
        f"    }}\n"
        f"    Remove-Job $__job -Force -ErrorAction SilentlyContinue\n"
        f"}} catch {{\n"
        f"    Write-Output (@{{ 'name'='{cmd_name}'; 'success'=$false; 'error'=$_.Exception.Message }} | ConvertTo-Json -Compress)\n"
        f"}}\n"
        f'[Console]::WriteLine("{self.CMD_END_MARKER}")\n'
        f"[Console]::Out.Flush()\n"
    )
```

**Wait** — `Start-Job` creates a new runspace without the Exchange session. This won't work for Exchange cmdlets.

Better approach: use `[System.Threading.Tasks.Task]::Run` or simply rely on Python-side timeout (which already works) and just ensure the markers are emitted. The PowerShell-side timeout adds complexity without benefit here.

**Revised approach**: Just move markers and fix ANSI regex. No PowerShell-side timeout. The Python-side `_read_until_marker` timeout + `_drain_and_sync` handles it.

## Summary

| Change | Purpose |
|--------|---------|
| Fix ANSI regex for DEC private mode (`\x1b[?Nh`) | Clean JSON output, proper sanitization |
| Move `CMD_START` before command execution | Distinguish "not received" from "cmdlet hanging" |
| Move `CMD_END` outside try/catch | Always emitted regardless of success/error |

After this fix, the next run will reveal whether Exchange cmdlets actually hang (we'll see `CMD_START` but timeout on `CMD_END`) or if there's a session/auth issue.

