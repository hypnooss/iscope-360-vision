

## Problem

`agentReady` only becomes `true` when a command **result** arrives. But the prompt is hidden until `agentReady` is true. Since no command can be sent without the prompt, it's a deadlock — the user can never type a command to trigger the first result.

## Fix

Send an automatic "probe" command (`pwd`) right after the realtime subscription is confirmed (`SUBSCRIBED`). This:
1. Queues a `pwd` command in the DB immediately
2. The agent picks it up on its next poll (~2s)
3. The result arrives via postgres_changes → sets `agentReady = true` and updates `currentCwd`
4. The prompt appears with the correct working directory

The probe output won't clutter the terminal — we'll mark it as a hidden/system command and suppress its output in the terminal lines.

### Changes in `RemoteTerminal.tsx`

**In the `.subscribe()` callback (line 172-182)**, after the system lines are added, automatically send a probe command:

```typescript
if (isSubscribed) {
  setConnecting(false);
  setLines((prev) => [
    ...prev,
    { type: "system", text: "Canal de comunicação estabelecido." },
    { type: "system", text: "Aguardando agente responder..." },
  ]);
  // Send silent probe to detect agent readiness + get cwd
  sendProbeCommand();
}
```

**Add a `sendProbeCommand` function** that inserts a `pwd` command with a special marker (e.g., command text `__probe__ pwd`) so the result handler can:
- Set `agentReady = true`
- Update `currentCwd` from stdout
- Suppress the output lines (don't show `pwd` result in terminal)
- Show the welcome messages only after probe succeeds

**In the postgres_changes handler**, when a result for a probe command arrives:
- Set `agentReady = true`, update `currentCwd`
- Add the welcome system lines ("Sessão remota iniciada...")
- Don't display the stdout/stderr as terminal lines
- Remove from pendingCommandIds

| File | Change |
|------|--------|
| `RemoteTerminal.tsx` | Add probe command on subscribe; filter probe results from display; show welcome messages after probe response |

