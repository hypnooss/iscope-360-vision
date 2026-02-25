

## Plan: On-Demand WebSocket Connection for Remote Terminal

### Current Problem

The agent maintains a **permanent 24/7 WebSocket connection** to Supabase Realtime, consuming resources and generating constant reconnect logs even when no one is using the Remote Terminal. This is wasteful, noisy, and less secure.

### New Architecture

```text
USER clicks "Conectar"
  → GUI sets agents.shell_session_active = true in DB
  → Next Heartbeat (≤120s) returns start_realtime: true
  → Supervisor starts WebSocket connection
  → Commands flow in real-time

USER disconnects (or 120s inactivity timeout)
  → Agent detects no commands for 120s → closes WebSocket
  → Agent sets agents.shell_session_active = false via heartbeat
  (or)
  → GUI sets agents.shell_session_active = false on disconnect
```

### Files to Modify

---

#### 1. Database: Add column `shell_session_active` to `agents` table

New migration adding:
- `shell_session_active` (boolean, NOT NULL, default false)

---

#### 2. Frontend: `src/components/agents/RemoteTerminal.tsx`

**On "Conectar" click:**
- Set `agents.shell_session_active = true` in Supabase (direct update)
- Existing logic continues (subscribe to postgres_changes for results)

**On "Desconectar" (or component unmount):**
- Set `agents.shell_session_active = false` in Supabase

This ensures the heartbeat picks up the flag on the next tick.

---

#### 3. Edge Function: `supabase/functions/agent-heartbeat/index.ts`

**In the heartbeat response**, read `shell_session_active` from the `agents` table (already fetched at line 602) and include it:

```typescript
// Add to the agents query (line 604):
.select('azure_certificate_key_id, check_components, certificate_thumbprint, shell_session_active')

// Add to response building:
if (agentData?.shell_session_active) {
  response.start_realtime = true;
}
```

Also update `HeartbeatSuccessResponse` interface to include `start_realtime?: boolean`.

---

#### 4. Supervisor: `python-agent/supervisor/main.py`

**Remove** the always-on Realtime startup (lines 72-80). Instead, manage the Realtime listener based on heartbeat response:

```python
# Remove:
realtime = RealtimeCommandListener(...)
realtime.start()

# In the main loop, after heartbeat result:
if result.get("start_realtime") and not realtime_active:
    realtime = RealtimeCommandListener(...)
    realtime.start()
    realtime_active = True
elif not result.get("start_realtime") and realtime_active:
    realtime.stop()
    realtime_active = False
```

---

#### 5. Agent Realtime: `python-agent/agent/realtime_commands.py`

**Add inactivity timeout (120 seconds):**

- Track `last_command_time` — updated whenever a command is received via broadcast
- In the main listen loop, check elapsed time since last command
- If `> 120s` with no command, log a message and break out of the connection loop (which causes `_listen_loop` to exit, and the Supervisor will see `start_realtime=false` on next heartbeat and not restart it)

Changes:
- Add `self._last_activity = time.time()` in `__init__`
- Update `self._last_activity` in `_handle_broadcast`
- In `_connect_and_listen` timeout check: if `time.time() - self._last_activity > 120`, break
- Modify `_listen_loop` to NOT auto-reconnect after inactivity timeout (add a `self._timed_out` flag)

---

#### 6. RPC function: `rpc_agent_heartbeat`

Add `shell_session_active` to the returned JSON so the edge function can access it without an extra query. Actually, the edge function already queries the `agents` table directly (line 602), so no RPC change is needed.

---

### Summary of Changes

| File | Change |
|------|--------|
| New migration | Add `shell_session_active` boolean column to `agents` |
| `src/components/agents/RemoteTerminal.tsx` | Set `shell_session_active` on connect/disconnect |
| `supabase/functions/agent-heartbeat/index.ts` | Read `shell_session_active`, return `start_realtime` flag |
| `python-agent/supervisor/main.py` | Start/stop Realtime based on heartbeat flag (not always-on) |
| `python-agent/agent/realtime_commands.py` | Add 120s inactivity timeout, `_timed_out` flag to prevent auto-reconnect |

### Behavior

- **No terminal open**: Agent never connects to WebSocket. Zero resource usage.
- **Terminal opened**: GUI flips flag → next heartbeat (≤120s) tells agent to connect → WebSocket established → real-time commands.
- **120s no commands**: Agent auto-closes WebSocket, stops reconnecting.
- **User disconnects**: GUI flips flag off → next heartbeat tells agent to stop (if not already timed out).
- **Fallback**: `has_pending_commands` in heartbeat still works for polling-based execution regardless of WebSocket state.

