

## Two Issues to Fix

### Issue 1: Prompt available before agent session is established

**Root cause:** The `connecting` state in the frontend transitions to "connected" as soon as the Supabase `postgres_changes` subscription reports `SUBSCRIBED`. This happens almost instantly (~1 second) because it's a client-side WebSocket to Supabase — it has nothing to do with whether the agent has started polling.

The agent only learns about `shell_session_active=true` on its next heartbeat (up to 60 seconds). So the user sees the prompt and can type commands, but the agent isn't listening yet.

**Fix:** Keep the terminal in a "waiting for agent" visual state after the subscription is ready. The prompt will be available (so commands queue in the DB), but show a banner/indicator that says "Aguardando agente conectar..." until the first command result is received. This way:
- User CAN type commands (they queue and will execute once agent connects)
- But it's clear the agent hasn't connected yet
- The banner disappears after the first successful command result

Changes in `RemoteTerminal.tsx`:
- Add `agentReady` state (boolean, default false)
- Set `agentReady = true` when the first command result arrives via postgres_changes
- Show a pulsing amber banner "⏳ Aguardando agente conectar... (comandos serão executados quando o agente responder)" above the prompt area
- The prompt remains functional but visually muted until `agentReady` is true

### Issue 2: Streaming commands show no output

**Root cause:** `subprocess.run()` with `capture_output=True` blocks until the process exits. Commands like `tail -f /var/log/...`, `top`, `watch`, `journalctl -f`, etc. never exit — they run indefinitely until killed or timeout.

The user sees nothing for 60 seconds, then gets a timeout error. The screenshot shows `tail -f` producing no output in the terminal.

**Fix:** Replace `subprocess.run()` with `subprocess.Popen()` for streaming output. Send incremental results every 2 seconds while the process is still running:

Changes in `python-agent/agent/remote_commands.py`:
- Detect if process is still running after a short initial wait (0.5s)
- If still running, switch to "streaming mode": read available stdout/stderr every 2 seconds and POST partial results with `status="running"`
- The frontend already listens for `UPDATE` events — extend it to also handle `status="running"` (append partial output)
- When the process exits or times out, send the final result with `status="completed"` or `status="timeout"`
- Use non-blocking reads with `select` or `threading` to read stdout/stderr without deadlocking

```python
def _execute_command(self, cmd: dict):
    # ... setup ...
    
    proc = subprocess.Popen(
        command_text, shell=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, cwd=self._cwd,
    )
    
    # Wait briefly for fast commands
    try:
        stdout, stderr = proc.communicate(timeout=1.0)
        # Command finished quickly — report as before
        self._report_result(...)
        return
    except subprocess.TimeoutExpired:
        pass  # Still running — switch to streaming
    
    # Streaming mode: send partial output every 2s
    start_time = time.time()
    while proc.poll() is None:
        if time.time() - start_time > timeout:
            proc.kill()
            self._report_result(..., status="timeout")
            return
        
        # Read available output (non-blocking via threads)
        partial_stdout = read_available(proc.stdout)
        partial_stderr = read_available(proc.stderr)
        
        if partial_stdout or partial_stderr:
            self._report_result(
                ..., stdout=partial_stdout, stderr=partial_stderr,
                status="running",  # Partial update
            )
        
        time.sleep(2)
    
    # Process finished — send final chunk
    remaining_stdout = proc.stdout.read()
    remaining_stderr = proc.stderr.read()
    self._report_result(..., status="completed")
```

Changes in `RemoteTerminal.tsx`:
- In the postgres_changes handler, also handle `status === "running"` — append partial output lines without removing the command from `pendingCommandIds`
- Only remove from `pendingCommandIds` when status is `completed`, `failed`, or `timeout`

Changes in `python-agent/agent/remote_commands.py` `_report_result`:
- For `status="running"`, use a PATCH-like approach: update the existing command row with appended output rather than replacing it
- Or simpler: the edge function `POST /agent-commands` already does an update — just send partial chunks. The frontend sees each UPDATE via postgres_changes

The edge function `POST /agent-commands` needs a small change:
- When `status="running"`, **append** stdout/stderr to existing values instead of replacing
- When `status="completed"/"failed"/"timeout"`, replace as before (final result)

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/agents/RemoteTerminal.tsx` | Add `agentReady` state with "Aguardando agente..." banner; handle `status="running"` for streaming output |
| `python-agent/agent/remote_commands.py` | Replace `subprocess.run` with `Popen` + streaming loop; send partial results every 2s with `status="running"` |
| `supabase/functions/agent-commands/index.ts` | Handle `status="running"` by appending stdout/stderr instead of replacing |

### Expected behavior

1. **Click "Conectar"** → Spinner while subscription connects (~1s) → Terminal shows prompt with amber banner "Aguardando agente conectar..." → Banner disappears after first command result
2. **`tail -f /var/log/...`** → Output streams into terminal every ~2 seconds in real-time → Blinking cursor shows command is still running → User can send Ctrl+C (as a new command to kill) or wait for timeout
3. **`ls`** → Completes in <1s → Result appears immediately (no streaming needed)

