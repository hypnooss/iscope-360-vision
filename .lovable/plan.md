

## Problem

When `shell=True` is used with `subprocess.Popen`, the SIGINT signal is sent only to the **shell process** (`/bin/sh`), not to the actual child process (`ping`, `tail -f`, etc.). The shell absorbs the signal and the child keeps running.

## Fix

Use `os.setsid` as `preexec_fn` to create a new process group, then send SIGINT to the **entire process group** via `os.killpg()` instead of just the shell PID.

### Changes in `python-agent/agent/remote_commands.py`

1. **Add `os.setsid` to Popen** (line 149):
```python
proc = subprocess.Popen(
    stripped,
    shell=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    cwd=self._cwd,
    preexec_fn=os.setsid,  # NEW: create process group
)
```

2. **Change signal delivery** (line 72) from `proc.send_signal(signal.SIGINT)` to `os.killpg(os.getpgid(proc.pid), signal.SIGINT)` — this sends SIGINT to the entire process group (shell + ping/tail/etc.):
```python
if self._running_proc and self._running_proc.poll() is None:
    try:
        pid = self._running_proc.pid
        pgid = os.getpgid(pid)
        os.killpg(pgid, signal.SIGINT)
        self.logger.info(f"[RemoteCmd] SIGINT enviado ao grupo {pgid} ...")
    except Exception as sig_err:
        # fallback: terminate
        self._running_proc.terminate()
```

3. **Also update the timeout kill** (around line 191) to use `os.killpg` so timeouts also properly kill the entire process group.

| File | Change |
|------|--------|
| `remote_commands.py` | Add `preexec_fn=os.setsid` to Popen; use `os.killpg` for SIGINT and timeout kill |

