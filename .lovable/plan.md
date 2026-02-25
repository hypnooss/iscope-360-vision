

## Diagnosis

There are **two critical bugs**, both caused by the same root issue:

### Root Cause: Python Module Caching in the Supervisor Process

When the Supervisor starts, Python loads `agent.version` into memory. The `get_version()` function returns `"1.3.2"` (the version at boot time). After the Supervisor successfully updates the Worker files to 1.3.3, it restarts the Worker subprocess — but **the Supervisor process itself never restarts**. Python's module cache still holds the old value `"1.3.2"`.

This causes:

1. **Heartbeat sends version "1.3.2"** → The edge function writes `agent_version = "1.3.2"` to the DB → The GUI shows "1.3.2"
2. **Backend compares 1.3.2 < 1.3.3** → Returns `update_available: true` every heartbeat → The Supervisor downloads and re-applies the update endlessly
3. **Worker killed every ~2 minutes** — visible in the logs where "Worker iniciado" repeats continuously

### Evidence from Logs

- Edge function logs: `version=1.3.2, latest=1.3.3, update=true` (every heartbeat)
- Worker logs: `Worker v1.3.3 iniciando...` followed by restart every ~2 minutes
- The Worker IS running 1.3.3, but the Supervisor heartbeat still reports 1.3.2

---

## Fix Plan

### 1. Reload `agent.version` module after a successful update

In `python-agent/supervisor/updater.py`, after replacing files and before restarting the Worker, force Python to reload the `agent.version` module so the Supervisor's heartbeat uses the new version:

```python
# In check_and_update(), after step 10 (system components), before step 11 (start worker):
import importlib
import agent.version
importlib.reload(agent.version)
self.logger.info(f"[Updater] Módulo agent.version recarregado: v{agent.version.get_version()}")
```

This ensures the next heartbeat sends the correct version, breaking the update loop.

### 2. Alternative / Belt-and-suspenders: Read version from disk

Add a `get_disk_version()` helper to `supervisor/updater.py` that reads `agent/version.py` from the install directory directly, bypassing module cache. This is a fallback in case `importlib.reload` doesn't propagate to the heartbeat module's cached import.

### Files to Modify

- **`python-agent/supervisor/updater.py`** — Add `importlib.reload(agent.version)` after file replacement in `check_and_update()`

### Deployment

After this fix, the Supervisor code itself needs to be updated on the hosts (since it's the Supervisor that has the bug, not the Worker). Options:
- Run `curl -fsSL .../agent-install | sudo bash -s -- --update` on each host
- Or manually restart the `iscope-supervisor` service after updating the files

