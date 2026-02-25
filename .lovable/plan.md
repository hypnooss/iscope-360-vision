

## 4 Issues Identified + Fixes

### Issue 1: Prompt available before agent is ready
**Current:** `handleConnect` immediately sets `connected=true` and shows the input prompt. The agent may not have started its poller yet (depends on next heartbeat, up to 60s).

**Fix:** After setting `shell_session_active=true`, keep the UI in "connecting" state. Transition to "connected" only when the `postgres_changes` subscription confirms `SUBSCRIBED`. Commands will queue in the DB and be picked up when the poller starts, so the user can type immediately after subscription is ready. Add a subtle indicator showing "Aguardando agente..." until the first command result arrives.

### Issue 2: `cd` doesn't work (can't change directory)
**Root cause:** Each command runs in its own `subprocess.run()` call, which spawns a new shell. `cd /opt` only changes the directory in that ephemeral subprocess — the next command starts fresh in the default working directory.

**Fix in `remote_commands.py`:** Maintain a persistent `self._cwd` (working directory) state. Detect `cd` commands and update `_cwd` accordingly. Pass `cwd=self._cwd` to every `subprocess.run()` call:

```python
class RemoteCommandHandler:
    def __init__(self, api, logger):
        self._cwd = "/"  # Start at root
        
    def _execute_command(self, cmd):
        command_text = cmd["command"]
        
        # Handle cd specially
        if command_text.strip().startswith("cd "):
            target = command_text.strip()[3:].strip()
            # Use subprocess to resolve the path (handles ~, .., etc.)
            result = subprocess.run(
                f"cd {target} && pwd",
                shell=True, capture_output=True, text=True,
                cwd=self._cwd, timeout=5,
            )
            if result.returncode == 0:
                self._cwd = result.stdout.strip()
                self._report_result(cmd["id"], "", "", 0, "completed")
            else:
                self._report_result(cmd["id"], "", result.stderr, 1, "failed")
            return
        
        # Regular command — run in current cwd
        result = subprocess.run(
            command_text, shell=True, capture_output=True, text=True,
            timeout=timeout, cwd=self._cwd,
        )
```

Also update the frontend prompt to reflect the current directory: the agent should return `cwd` in its command result, and the frontend should update the prompt accordingly (`root@agent:/opt/iscope-agent#` instead of always `root@agent:~#`).

### Issue 3: First command delay (up to 60s)
**Root cause:** The first command goes into the DB. The agent only discovers `shell_session_active=true` on the next heartbeat (60s interval). Until then, the command sits as `pending`.

**Current mitigation:** The heartbeat also checks `has_pending_commands` and calls `process_pending_commands()` even without the poller. So the first command executes on the next heartbeat tick.

**The first command already ran within ~1 second of the heartbeat.** The logs show:
```
16:36:49,253 [Supervisor] Heartbeat OK → GET /agent-commands → 1 comando pendente → executed
16:36:50,134 [Supervisor] Heartbeat solicitou início do Shell Poller
```

This is working as designed. The initial delay is the time until the next heartbeat fires. To reduce this, we could lower the heartbeat interval when the GUI opens a session, but 60s is acceptable for the initial connection.

### Issue 4: Agent keeps polling after `exit`
**Root cause:** When the user types `exit`, the frontend sets `shell_session_active=false` in the DB. But the agent only reads this flag via heartbeat (every 60s). The `ShellCommandPoller` keeps calling `GET /agent-commands` for up to 60s after the session ends.

**Fix:** Have the `agent-commands` edge function return a `session_active` field by reading the `shell_session_active` column. The poller checks this on every poll (every 2s) and stops immediately when it's `false`:

```typescript
// In agent-commands GET handler, after fetching commands:
const { data: agentStatus } = await supabase
  .from('agents')
  .select('shell_session_active')
  .eq('id', agentId)
  .single();

return Response.json({
  commands: commands || [],
  session_active: agentStatus?.shell_session_active ?? false,
});
```

```python
# In ShellCommandPoller._poll_once():
response = self.handler.api.get("/agent-commands")
if not response.get("session_active", True):
    self.logger.info("[ShellPoll] Sessão encerrada pelo GUI. Parando poller.")
    self._session_closed = True
    return False
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `python-agent/agent/remote_commands.py` | Add `_cwd` state, handle `cd` commands, pass `cwd` to all `subprocess.run()`, return `cwd` in result |
| `python-agent/agent/realtime_commands.py` | Check `session_active` response field; stop poller immediately when false |
| `supabase/functions/agent-commands/index.ts` | Return `session_active` field in GET response by reading `shell_session_active` from agents table |
| `src/components/agents/RemoteTerminal.tsx` | Wait for `realtimeConnected` before showing prompt; update prompt with cwd from command results; show "Aguardando agente..." indicator |

### Expected Behavior After Fix

1. **Click "Conectar"** → Loading spinner until postgres_changes is SUBSCRIBED → prompt appears
2. **`cd /opt`** → Works. Next `ls` shows `/opt` contents. Prompt updates to `root@agent:/opt#`
3. **First command** → Queued immediately, picked up on next heartbeat (~60s max), then poller starts for subsequent commands (~2-3s)
4. **`exit`** → GUI disconnects immediately. Agent detects `session_active=false` within 2 seconds and stops polling. No lingering `GET /agent-commands` calls.

