

## Root Cause: `agent/updater.py` Deletes `supervisor/`

The log on the host shows `"Arquivos substituídos com sucesso"` (without the "(supervisor/ preservado)" suffix). This means the code running the update is **`agent/updater.py`**, NOT `supervisor/updater.py`.

### Full chain of events:

```text
1. Install --update runs
   ├─ Cleans /opt/iscope-agent (except venv, .env, storage, logs)
   ├─ Extracts agent tar → creates agent/, main.py, etc.
   ├─ Extracts supervisor tar → creates supervisor/ ✓
   └─ Starts iscope-supervisor service

2. Supervisor starts (with OLD code in memory)
   ├─ Heartbeat sends stale version (v1.3.3 from import cache)
   ├─ Backend says update_available=true (latest is v1.3.4)
   └─ supervisor/updater.py runs update → preserves supervisor/ ✓
      (BUT: this update also has the version bug, so loop continues)

3. Meanwhile, agent/updater.py (Worker's own updater, OLD code)
   ├─ preserved = ['venv', 'storage', 'logs', '.env']
   ├─ *** 'supervisor' is NOT in preserved list ***
   ├─ Deletes supervisor/ during _replace_files()
   └─ supervisor/ is gone forever
```

The critical difference:
- `supervisor/updater.py` line 205: `preserved = {"venv", "storage", "logs", ".env", "supervisor"}` — preserves supervisor/
- `agent/updater.py` line 208: `preserved = ['venv', 'storage', 'logs', '.env']` — **does NOT preserve supervisor/**

Even though `supervisor/updater.py` is correct, at some point `agent/updater.py` runs (when the Worker itself tries a self-update) and wipes out `supervisor/`.

## Plan

### 1. Fix `agent/updater.py` — Add `supervisor` to preserved list

File: `python-agent/agent/updater.py`, line 208

Change:
```python
preserved = ['venv', 'storage', 'logs', '.env']
```
To:
```python
preserved = ['venv', 'storage', 'logs', '.env', 'supervisor']
```

This is the only code change needed. It ensures that no matter which updater runs, the `supervisor/` directory is never deleted.

### 2. Rebuild agent package v1.3.4

Since the user wants to keep using v1.3.4, the agent tar (`iscope-agent-1.3.4.tar.gz` and `iscope-agent-latest.tar.gz`) must be rebuilt with this fix plus the previous fixes to `supervisor/heartbeat.py` and `supervisor/main.py`.

Both tars (agent + supervisor) need to be uploaded to the bucket with all fixes included.

### 3. No other changes needed

- No Edge Function changes
- No database changes
- `supervisor/updater.py` already has the correct preservation logic

### Technical Summary

| File | Change |
|------|--------|
| `python-agent/agent/updater.py` line 208 | Add `'supervisor'` to `preserved` list |

This is a one-line fix that prevents the Worker's self-updater from deleting the Supervisor directory during file replacement.

