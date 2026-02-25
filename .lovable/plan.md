

## Root Cause

The `RealtimeCommandListener.__init__` unconditionally calls `supabase_url.replace(...)` on line 55, but `SUPABASE_URL` is not set in the agent's env file (it was added in 1.3.3). The None-check only exists in `start()`, which never gets called because `__init__` crashes first.

## Fix

**File: `python-agent/agent/realtime_commands.py`** — Move the URL construction behind a None guard in `__init__`:

```python
# Line 53-55, change from:
ws_base = supabase_url.replace("https://", "wss://").replace("http://", "ws://")
self.ws_url = f"{ws_base}/realtime/v1/websocket?apikey={supabase_key}&vsn=1.0.0"
self.topic = f"realtime:agent-cmd-{agent_id}"

# To:
self.ws_url = None
self.topic = f"realtime:agent-cmd-{agent_id}"
if supabase_url:
    ws_base = supabase_url.replace("https://", "wss://").replace("http://", "ws://")
    self.ws_url = f"{ws_base}/realtime/v1/websocket?apikey={supabase_key}&vsn=1.0.0"
```

This way `__init__` never crashes on None. The existing guard in `start()` already handles the case where URL/key are missing by logging a warning and returning gracefully.

## Immediate Workaround

While the code fix is pending, you can unblock the agent right now by adding these two lines to `/etc/iscope/agent.env`:

```
SUPABASE_URL=https://akbosdbyheezghieiefz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYm9zZGJ5aGVlemdoaWVpZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTEyODAsImV4cCI6MjA4NTE4NzI4MH0.9n-nUenSCwYIGztsfgVAbgis9wEakQDKX3Oe2xBiNvo
```

Then `sudo systemctl restart iscope-supervisor`.

