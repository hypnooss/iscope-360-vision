

## Ctrl+C (SIGINT) for the Remote Terminal

Since the browser intercepts `Ctrl+C` as "copy to clipboard," we cannot forward a raw SIGINT signal. Instead, we need a special command mechanism to kill the running process on the agent side.

### Approach

**Frontend (`RemoteTerminal.tsx`):**
- Intercept `Ctrl+C` in the `handleKeyDown` handler when a command is currently running (`pendingCommandIds.size > 0`)
- Send a special command `__signal__ SIGINT` to the database
- Display `^C` in the terminal output as visual feedback
- The `Ctrl+C` handler fires even when the input form is hidden (during pending commands), so we need to attach a keydown listener to the terminal body `div` as well

**Agent (`remote_commands.py`):**
- Track the currently running `subprocess.Popen` process in an instance variable (`self._running_proc` and `self._running_cmd_id`)
- When `__signal__ SIGINT` is received as a command, instead of executing it as a shell command, send `SIGINT` to `self._running_proc` via `proc.send_signal(signal.SIGINT)` (or `proc.terminate()` as fallback)
- The streaming loop will then detect the process exited and report the final result naturally
- Mark the signal command itself as `completed` immediately (it's not a real command)

### Changes

**`src/components/agents/RemoteTerminal.tsx`:**
- In `handleKeyDown`, add a `Ctrl+C` handler: if `hasPending`, prevent default, append `^C` line, and call `sendCommand.mutate("__signal__ SIGINT")`
- Move the keydown listener to the terminal body div (not just the input) so it works even when the input is hidden during pending commands
- Add a `onKeyDown` handler to the terminal body div that checks for `Ctrl+C`

**`python-agent/agent/remote_commands.py`:**
- Add `self._running_proc = None` and `self._running_cmd_id = None` instance variables
- In `_execute_command`, before `Popen`, set `self._running_proc`; clear it in `finally`
- Detect `__signal__ SIGINT` command: if `self._running_proc` is not None, call `self._running_proc.send_signal(signal.SIGINT)`; mark the signal command as `completed` immediately
- Import `signal` module

### Detailed Code Plan

#### `RemoteTerminal.tsx` — Ctrl+C handler

In the terminal body div (around line 430), add `onKeyDown` and `tabIndex={0}` so it can receive keyboard events:

```tsx
<div
  className="flex-1 overflow-y-auto p-3 font-mono text-sm cursor-text"
  onClick={focusInput}
  onKeyDown={handleTerminalKeyDown}
  tabIndex={0}
>
```

New `handleTerminalKeyDown` function:
```typescript
const handleTerminalKeyDown = (e: React.KeyboardEvent) => {
  if (e.ctrlKey && e.key === "c" && hasPending) {
    e.preventDefault();
    setLines((prev) => [...prev, { type: "system", text: "^C" }]);
    sendCommand.mutate("__signal__ SIGINT");
  }
};
```

#### `remote_commands.py` — Signal handling

In `__init__`, add:
```python
self._running_proc = None
self._running_cmd_id = None
```

In `_execute_command`, detect signal commands early (after dedup, before probe strip):
```python
if command_text.strip() == "__signal__ SIGINT":
    if self._running_proc and self._running_proc.poll() is None:
        self._running_proc.send_signal(signal.SIGINT)
        self.logger.info(f"[RemoteCmd] SIGINT enviado ao processo (cmd {self._running_cmd_id[:8]}...)")
    self._report_result(command_id=command_id, stdout="", stderr="", exit_code=0, status="completed", cwd=self._cwd)
    return
```

Set `self._running_proc = proc` right after `Popen()` call, and clear it in `finally`.

| File | Change |
|------|--------|
| `RemoteTerminal.tsx` | Add `Ctrl+C` interception on terminal div; send `__signal__ SIGINT` command; show `^C` feedback |
| `remote_commands.py` | Track running process; handle `__signal__ SIGINT` by sending SIGINT to active subprocess |

