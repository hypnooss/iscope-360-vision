

## Two Fixes

### Fix 1: Hide prompt until agent responds

The prompt input form shows when `inputReady` (`connected && realtimeConnected`) is true, but `realtimeConnected` just means the Supabase WebSocket subscription is active -- not that the agent is polling. The `agentReady` state already exists and is set to `true` on first command result, but it is not used to gate the prompt.

**Change in `RemoteTerminal.tsx` line 416:**
```
// Before:
{!hasPending && inputReady && (

// After:
{!hasPending && inputReady && agentReady && (
```

This ensures the prompt only appears after the agent has responded to at least one command. The "Aguardando agente conectar..." banner (lines 379-386) already covers the waiting state.

### Fix 2: No timeout for streaming commands

The agent's `_execute_command` enforces a hard 60-second timeout in the streaming loop (line 149). For commands producing continuous output (like `tail -f`), the output IS being received every 2 seconds, but the elapsed time still hits 60s and kills the process.

**Fix:** Reset the timeout timer whenever new output is received. If the command is actively producing output, it should never timeout. Only timeout after 60 seconds of **silence** (no new output).

**Change in `remote_commands.py` streaming loop (lines 147-182):**
```python
while proc.poll() is None:
    elapsed_since_last_output = time.time() - last_output_time
    if elapsed_since_last_output > timeout:
        proc.kill()
        # ... timeout handling
        return

    partial_stdout = self._read_available(proc.stdout)
    partial_stderr = self._read_available(proc.stderr)

    if partial_stdout or partial_stderr:
        last_output_time = time.time()  # Reset timeout on output
        # ... accumulate and report
```

This way `tail -f` will stream indefinitely as long as log lines keep coming. It only times out after 60 seconds of complete silence.

---

### Summary

| File | Change |
|------|--------|
| `RemoteTerminal.tsx` line 416 | Add `&& agentReady` to prompt visibility condition |
| `remote_commands.py` lines 144-182 | Track `last_output_time`, reset on each output chunk, timeout only on silence |

