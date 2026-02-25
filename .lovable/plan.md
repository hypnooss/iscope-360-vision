

## Comprehensive Agent & Edge Function Audit

After reviewing all Python agent files, edge functions, and frontend components, here are all issues found, organized by severity.

---

### CRITICAL BUGS (causing immediate failures)

#### 1. Realtime WebSocket reconnect loop (the one you're seeing now)

**Files**: `python-agent/agent/realtime_commands.py`

Three problems combine into a tight reconnect loop (~2 connections/second):

**a) Missing `access_token` in join payload** — Supabase Realtime requires the anon key as `access_token` in the Phoenix join message. Without it, the server accepts the WebSocket but immediately closes the channel after join.

```python
# Current (line 130-136):
join_payload = {
    "config": {
        "broadcast": {"self": False},
        "presence": {"key": ""},
        "postgres_changes": []
    }
}

# Fix — add access_token:
join_payload = {
    "config": {
        "broadcast": {"self": False},
        "presence": {"key": ""},
        "postgres_changes": []
    },
    "access_token": self.supabase_key
}
```

**b) "Channel joined" logged before server confirms** — The log at line 143 fires immediately after *sending* the join, not after receiving `phx_reply` with `status: "ok"`. This masks the real error (server rejecting the join).

Fix: wait for the first `ws.recv()` after join, parse the `phx_reply`, and only proceed if `status == "ok"`. If rejected, raise an exception to trigger backoff.

**c) Backoff never increases on rapid disconnects** — When `_connect_and_listen` returns normally (via `break` on `WebSocketConnectionClosedException`), `_listen_loop` resets `backoff = 2` (line 115). Since reconnect takes ~400ms, the effective wait is zero.

Fix: track `connect_start = time.time()` before `_connect_and_listen()`. If elapsed < 5 seconds, treat as a failed connection and increase backoff instead of resetting.

---

#### 2. Installer does not write `SUPABASE_URL` / `SUPABASE_ANON_KEY` to agent.env

**File**: `supabase/functions/agent-install/index.ts`, lines 780-787

The `write_env_file()` function generates `/etc/iscope/agent.env` but does NOT include the two variables needed for Realtime:

```bash
# Current content:
AGENT_API_BASE_URL=${API_BASE_URL}
AGENT_POLL_INTERVAL=${POLL_INTERVAL}
AGENT_STATE_FILE=${STATE_DIR}/state.json
AGENT_LOG_FILE=/var/log/iscope-agent/agent.log
AGENT_ACTIVATION_CODE=${ACTIVATION_CODE}
SUPERVISOR_HEARTBEAT_INTERVAL=120
# Missing: SUPABASE_URL and SUPABASE_ANON_KEY
```

This means Realtime will never work on any newly installed agent. The `__init__` guard we added prevents the crash, but the feature is silently disabled.

Fix: Add these two lines to the env file template:

```
SUPABASE_URL=https://${PROJECT_REF}.supabase.co
SUPABASE_ANON_KEY=<anon_key>
```

The anon key is already public (it's in the installer URL), so including it is safe.

---

#### 3. Duplicate `return null` in `agent-heartbeat` edge function

**File**: `supabase/functions/agent-heartbeat/index.ts`, lines 425-426

```typescript
    console.error(`Failed to upload certificate to App Registration: ${result.error}`);
    return null;
    return null;  // <-- dead code, unreachable
```

Not a functional bug (dead code), but worth cleaning up.

---

### MODERATE ISSUES (functional but suboptimal)

#### 4. Worker's `HeartbeatWorker` still references legacy `iscope-agent` service

**File**: `python-agent/agent/heartbeat_worker.py`, line 107

```python
proc = subprocess.run(
    ['sudo', 'systemctl', 'restart', 'iscope-agent'],  # Legacy name
    ...
)
```

Under the Supervisor architecture, the Worker should never restart itself. This code runs when `check_components` is flagged, but it tries to restart `iscope-agent` (which no longer exists). It should be `iscope-supervisor` or, better yet, not restart at all since the Supervisor handles this.

**Fix**: Either change to `iscope-supervisor` or remove this block entirely (the Supervisor's `main.py` already handles `check_components` at line 108-111).

#### 5. Worker's `AutoUpdater._request_restart` references `iscope-agent`

**File**: `python-agent/agent/updater.py`, line 275

```python
result = subprocess.run(
    ['systemctl', 'restart', 'iscope-agent'],  # Legacy name
    ...
)
```

Same issue — under Supervisor architecture, the Worker's own updater is unused (the `SupervisorUpdater` handles updates), but if it ever runs, it tries to restart a non-existent service.

**Fix**: This class is effectively dead code now. Mark as deprecated or remove.

#### 6. `supervisor/config.py` reads `SUPABASE_URL` from env but default path is `/etc/iscope/agent.env`

**File**: `python-agent/supervisor/config.py` loads from `/etc/iscope/agent.env` (via `_load_env()`), but the installer writes to `$CONFIG_DIR/agent.env` which defaults to `/etc/iscope-agent/agent.env`.

Wait — actually looking closer, the installer uses `CONFIG_DIR="/etc/iscope-agent"` (line 31 of the install script) but the Python config uses `/etc/iscope/agent.env`. These paths **don't match**.

Let me re-check... The installer writes to `$CONFIG_DIR/agent.env` where `CONFIG_DIR="/etc/iscope-agent"`, producing `/etc/iscope-agent/agent.env`. But `supervisor/config.py` and `agent/config.py` both load from `/etc/iscope/agent.env`.

Actually, looking at the install script more carefully: `CONFIG_DIR="/etc/iscope-agent"` is declared at line 30, but `--config-dir` flag (line 90) can override it. The default `/etc/iscope-agent` vs Python's `/etc/iscope/` — this is potentially a path mismatch. However, since dotenv also loads from `.env` in CWD and the agent seems to work, the env vars must be getting loaded somehow (perhaps the systemd unit sets `EnvironmentFile=`).

This would need verification on the actual host: `cat /etc/systemd/system/iscope-supervisor.service` to confirm which env file it uses. Not blocking since the agent is working, but worth confirming.

---

### LOW PRIORITY (code quality)

#### 7. `agent/auth.py` has duplicate capability detection

Both `agent/auth.py` (`get_agent_capabilities()` at line 39) and `agent/heartbeat.py` (`_detect_capabilities()` at line 34) detect capabilities with different implementations. The heartbeat version uses `shutil.which()` for system binaries; the auth version checks Python imports. They could be consolidated.

#### 8. Broadcast channel name mismatch potential

Frontend broadcasts to channel `agent-cmd-${agentId}` (RemoteTerminal.tsx line 141), and the agent subscribes to `realtime:agent-cmd-${agentId}` (realtime_commands.py line 56). The `realtime:` prefix is the Phoenix topic prefix, which Supabase JS SDK adds automatically. This is correct — no issue here.

---

### SUMMARY — Files to modify

| # | File | Change | Priority |
|---|------|--------|----------|
| 1a | `python-agent/agent/realtime_commands.py` | Add `access_token` to join payload | Critical |
| 1b | `python-agent/agent/realtime_commands.py` | Wait for join confirmation before listening | Critical |
| 1c | `python-agent/agent/realtime_commands.py` | Fix backoff on rapid disconnects | Critical |
| 2 | `supabase/functions/agent-install/index.ts` | Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to env template | Critical |
| 3 | `supabase/functions/agent-heartbeat/index.ts` | Remove duplicate `return null` | Low |
| 4 | `python-agent/agent/heartbeat_worker.py` | Fix or remove legacy `iscope-agent` restart | Moderate |
| 5 | `python-agent/agent/updater.py` | Mark as deprecated (dead code under Supervisor) | Low |

All changes in #1 are in the same file and can be done in one edit. Item #2 is a separate edge function deploy.

