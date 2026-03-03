

## Bump Agent version to 1.3.6

A single-line change to release the new version with the PowerShell executor improvements.

**File**: `python-agent/agent/version.py`

**Change**: Update `__version__` from `"1.3.5"` to `"1.3.6"`

After the version bump, you will need to:
1. Build the new `.tar.gz` package
2. Upload `iscope-agent-latest.tar.gz` to the `agent-releases` bucket (overwriting the previous one)
3. Agents with auto-update enabled will pick up the new version on the next heartbeat cycle

