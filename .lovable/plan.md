
# Fix: Use DNS Hostname for httpx (Avoid 301 Redirects)

## Problem

When the Attack Surface pipeline scans DNS-sourced targets, all three tools (masscan, nmap, httpx) use the raw IP address. This causes httpx to receive `301 Moved Permanently` responses because web servers (especially shared hosting / cloud load balancers like Microsoft IIS) require the correct `Host` header or SNI to serve the actual content.

The hostname (e.g., `mail.movecta.com.br`) is already available in the task payload as `label`, but it's never propagated to the httpx executor.

## Solution

Propagate the DNS hostname through the context so httpx uses it as the target (proper Host header + SNI), while masscan and nmap continue using the raw IP (they operate at the network/transport layer).

## Changes

### 1. `python-agent/agent/tasks.py` - Propagate hostname from payload to context

In the `execute()` method, after building the initial context, inject `hostname` from the task payload when the source is DNS:

```python
# After line 75: context = self._build_context(target)
if payload.get('source') == 'dns' and payload.get('label'):
    context['hostname'] = payload['label']
```

This ensures the hostname is available in the shared context for all executors, but only httpx will use it.

### 2. `python-agent/agent/executors/httpx_executor.py` - Use hostname when available

Modify the `run()` method to prefer `hostname` over `ip` as the target for httpx:

```python
def run(self, step, context):
    params = step.get('params', {})
    ip = params.get('ip') or context.get('ip')
    hostname = params.get('hostname') or context.get('hostname')
    
    # Use hostname for httpx when available (proper Host/SNI headers)
    target = hostname if hostname else ip
    
    if not target:
        return {'error': 'IP or hostname is required'}
    
    # ... ports logic stays the same ...
    
    cmd = [
        'httpx',
        '-u', target,    # <-- hostname instead of IP
        '-ports', port_str,
        ...
    ]
```

The returned data will still include the original `ip` for reference:

```python
return {
    'data': {
        'ip': ip,
        'hostname': hostname or '',
        'web_services': web_services,
    }
}
```

### 3. No changes to masscan or nmap

- **masscan**: Sends raw SYN packets -- must use IP address
- **nmap**: Service fingerprinting at transport level -- IP is correct

### 4. No database or Edge Function changes needed

The `label` field already exists in `attack_surface_tasks` and is already passed to the agent via the RPC's `payload` object. No schema changes required.

## Expected Result

Before (current):
```
httpx -u 52.98.163.56 -ports 80  -->  301 (redirect, no useful data)
```

After (fix):
```
httpx -u mail.movecta.com.br -ports 80  -->  200 (actual content, title, technologies)
```

For firewall-sourced IPs (where `label` is something like "FW01 - port1"), the hostname won't be set and httpx will continue using the IP as before -- this is correct because firewall WAN IPs typically host direct services without virtual hosting.

## Risk Assessment

- **Low risk**: Only affects httpx targeting, masscan/nmap unchanged
- **Backwards compatible**: Falls back to IP when no hostname available
- **No data model changes**: Uses existing `label` field from payload
