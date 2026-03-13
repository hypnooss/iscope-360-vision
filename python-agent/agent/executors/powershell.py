"""
PowerShell executor for M365 commands.
Uses certificate-based authentication for Exchange Online and Microsoft Graph.
Supports both batch (run) and interactive (run_interactive) execution modes.
"""

import json
import os
import queue
import re
import subprocess
import shutil
import tempfile
import threading
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable

from agent.executors.base import BaseExecutor


class PowerShellExecutor(BaseExecutor):
    """
    Executes PowerShell commands for M365 analysis.
    Supports Exchange Online and Microsoft Graph modules.
    Supports both Certificate-Based Authentication (CBA) and Credential-based authentication.
    
    Two execution modes:
    - run(): Batch mode - all commands in a single script (legacy, used for single commands/RBAC)
    - run_interactive(): Progressive mode - persistent session, one command at a time with
      immediate result reporting. Resilient to individual command timeouts.
    """
    
    CERT_DIR = Path("/var/lib/iscope-agent/certs")
    CERT_FILE = CERT_DIR / "m365.crt"
    KEY_FILE = CERT_DIR / "m365.key"
    PFX_FILE = CERT_DIR / "m365.pfx"
    THUMBPRINT_FILE = CERT_DIR / "thumbprint.txt"
    
    # Authentication modes
    AUTH_MODE_CBA = "cba"  # Certificate-Based Authentication (default)
    AUTH_MODE_CREDENTIAL = "credential"  # Username/Password (for initial RBAC setup)
    
    # Interactive session delimiters
    CMD_START_MARKER = "---ISCOPE_CMD_START---"
    CMD_END_MARKER = "---ISCOPE_CMD_END---"
    SESSION_READY_MARKER = "---ISCOPE_SESSION_READY---"
    SYNC_MARKER = "---ISCOPE_SYNC---"
    ANSI_ESCAPE_RE = re.compile(r'\x1b\[[\x20-\x3f]*[0-9;]*[\x20-\x7e]|\x1b\].*?\x07')
    
    # Consecutive timeout threshold before killing session
    MAX_CONSECUTIVE_TIMEOUTS = 3
    
    # Supported modules and their connection commands
    MODULES = {
        "ExchangeOnline": {
            "import": "Import-Module ExchangeOnlineManagement -ErrorAction Stop",
            "connect_cba": 'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -Organization "{organization}" -ShowBanner:$false',
            "connect_credential": 'Connect-ExchangeOnline -Credential $cred -ShowBanner:$false',
            "disconnect": "Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue",
        },
        "MicrosoftGraph": {
            "import": "Import-Module Microsoft.Graph.Authentication -ErrorAction Stop",
            "connect_cba": 'Connect-MgGraph -ClientId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -TenantId "{tenant_id}" -NoWelcome',
            "connect_credential": 'Connect-MgGraph -Credential $cred -TenantId "{tenant_id}" -NoWelcome',
            "disconnect": "Disconnect-MgGraph -ErrorAction SilentlyContinue",
        },
        "PnP.PowerShell": {
            "import": "Import-Module PnP.PowerShell -ErrorAction Stop",
            "connect_cba": 'Connect-PnPOnline -Url "https://{spo_admin_domain}-admin.sharepoint.com" -ClientId "{app_id}" -CertificatePath "{cert_path}" -Tenant "{tenant_id}"',
            "connect_credential": 'Connect-PnPOnline -Url "https://{spo_admin_domain}-admin.sharepoint.com" -Credential $cred',
            "disconnect": "Disconnect-PnPOnline -ErrorAction SilentlyContinue",
        },
    }

    def __init__(self, logger):
        super().__init__(logger)
        self._pwsh_path: Optional[str] = None
    
    def _find_pwsh(self) -> Optional[str]:
        """Find PowerShell Core executable."""
        if self._pwsh_path:
            return self._pwsh_path
        
        candidates = ["pwsh", "/usr/bin/pwsh", "/opt/microsoft/powershell/7/pwsh"]
        for candidate in candidates:
            path = shutil.which(candidate)
            if path:
                self._pwsh_path = path
                return path
        
        return None
    
    def _check_prerequisites(self) -> Dict[str, Any]:
        """Check if all prerequisites are met for PowerShell execution."""
        errors = []
        
        pwsh = self._find_pwsh()
        if not pwsh:
            errors.append("PowerShell Core (pwsh) not found. Install with: sudo apt install -y powershell")
        
        if not self.PFX_FILE.exists():
            if self.CERT_FILE.exists() and self.KEY_FILE.exists():
                errors.append(f"PFX file not found: {self.PFX_FILE}. Run 'sudo touch /var/lib/iscope-agent/check_components.flag && sudo systemctl restart iscope-agent' to regenerate")
            else:
                errors.append(f"Certificate files not found in {self.CERT_DIR}")
        
        if errors:
            return {"error": "; ".join(errors), "prerequisite_check": False}
        
        return {"prerequisite_check": True, "pwsh_path": pwsh}
    
    def _get_thumbprint(self) -> Optional[str]:
        """Read certificate thumbprint from file."""
        if self.THUMBPRINT_FILE.exists():
            return self.THUMBPRINT_FILE.read_text().strip()
        return None
    
    def _build_script(
        self,
        module: str,
        commands: List[Dict[str, Any]],
        app_id: str,
        tenant_id: str,
        organization: Optional[str] = None,
        auth_mode: str = "cba",
        username: Optional[str] = None,
        password: Optional[str] = None
    ) -> str:
        """Build a PowerShell script for batch execution (legacy mode)."""
        if module not in self.MODULES:
            raise ValueError(f"Unsupported module: {module}. Supported: {list(self.MODULES.keys())}")
        
        module_config = self.MODULES[module]
        
        if not organization:
            organization = f"{tenant_id}"
        
        script_parts = [
            "$ErrorActionPreference = 'Stop'",
            "$ProgressPreference = 'SilentlyContinue'",
            "",
            "# Override HOME to agent state dir (EXO 3.9+ requires valid HOME for Split-Path)",
            "$env:HOME = '/var/lib/iscope-agent'",
            "",
            "# Import module",
            module_config["import"],
            "",
        ]
        
        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            if not username or not password:
                raise ValueError("Username and password are required for credential-based authentication")
            
            escaped_password = password.replace('"', '`"').replace("'", "`'").replace('$', '`$')
            
            script_parts.extend([
                "# Create credential object",
                f'$secPassword = ConvertTo-SecureString "{escaped_password}" -AsPlainText -Force',
                f'$cred = New-Object System.Management.Automation.PSCredential("{username}", $secPassword)',
                "",
                "# Connect with credentials",
                module_config["connect_credential"].format(tenant_id=tenant_id, spo_admin_domain=(organization or '').replace('.onmicrosoft.com', '').split('.')[0]),
                "",
            ])
        else:
            # Derive SPO admin domain from organization (e.g. contoso.onmicrosoft.com -> contoso)
            spo_admin_domain = (organization or '').replace('.onmicrosoft.com', '').split('.')[0]
            thumbprint = self._get_thumbprint() or ''
            script_parts.extend([
                "# Connect with certificate",
                module_config["connect_cba"].format(
                    app_id=app_id,
                    cert_path=str(self.PFX_FILE),
                    tenant_id=tenant_id,
                    organization=organization,
                    spo_admin_domain=spo_admin_domain,
                    thumbprint=thumbprint
                ),
                "",
            ])
        
        script_parts.extend([
            "# Initialize results",
            "$results = @{}",
            "",
        ])
        
        for cmd in commands:
            cmd_name = cmd.get("name", cmd.get("command", "unknown"))
            cmd_text = cmd.get("command", "")
            
            if not cmd_text:
                continue
            
            script_parts.extend([
                f"# Command: {cmd_name}",
                "try {",
                f"    $results['{cmd_name}'] = @{{",
                f"        'data' = ({cmd_text} | ConvertTo-Json -Depth 10 -Compress);",
                "        'success' = $true",
                "    }",
                "} catch {",
                f"    $results['{cmd_name}'] = @{{",
                "        'error' = $_.Exception.Message;",
                "        'success' = $false",
                "    }",
                "}",
                "",
            ])
        
        script_parts.extend([
            "# Disconnect",
            module_config["disconnect"],
            "",
            "# Output results as JSON with delimiter marker",
            "Write-Output '---ISCOPE_JSON_START---'",
            "$results | ConvertTo-Json -Depth 10 -Compress",
        ])
        
        return "\n".join(script_parts)

    def _build_interactive_preamble(
        self,
        module: str,
        app_id: str,
        tenant_id: str,
        organization: Optional[str] = None,
        auth_mode: str = "cba",
        username: Optional[str] = None,
        password: Optional[str] = None
    ) -> str:
        """Build the PowerShell preamble (import + connect) for interactive sessions."""
        if module not in self.MODULES:
            raise ValueError(f"Unsupported module: {module}. Supported: {list(self.MODULES.keys())}")
        
        module_config = self.MODULES[module]
        
        if not organization:
            organization = f"{tenant_id}"
        
        lines = [
            # Diagnostic echo to verify pipe works before anything else
            '[Console]::WriteLine("---ISCOPE_PIPE_TEST---")',
            "[Console]::Out.Flush()",
            "",
            "$ErrorActionPreference = 'Continue'",
            "$ProgressPreference = 'SilentlyContinue'",
            "$env:HOME = '/var/lib/iscope-agent'",
            "",
            module_config["import"],
            "",
        ]
        
        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            if not username or not password:
                raise ValueError("Username and password are required for credential-based authentication")
            escaped_password = password.replace('"', '`"').replace("'", "`'").replace('$', '`$')
            lines.extend([
                f'$secPassword = ConvertTo-SecureString "{escaped_password}" -AsPlainText -Force',
                f'$cred = New-Object System.Management.Automation.PSCredential("{username}", $secPassword)',
                module_config["connect_credential"].format(tenant_id=tenant_id, spo_admin_domain=(organization or '').replace('.onmicrosoft.com', '').split('.')[0]),
            ])
        else:
            spo_admin_domain = (organization or '').replace('.onmicrosoft.com', '').split('.')[0]
            thumbprint = self._get_thumbprint() or ''
            lines.extend([
                module_config["connect_cba"].format(
                    app_id=app_id,
                    cert_path=str(self.PFX_FILE),
                    tenant_id=tenant_id,
                    organization=organization,
                    spo_admin_domain=spo_admin_domain,
                    thumbprint=thumbprint
                ),
            ])
        
        lines.extend([
            "",
            f'[Console]::WriteLine("{self.SESSION_READY_MARKER}")',
            "[Console]::Out.Flush()",
        ])
        
        return "\n".join(lines) + "\n"
    
    def _build_interactive_command(self, cmd_name: str, cmd_text: str) -> str:
        """Build a single command wrapped with delimiters for interactive parsing.
        
        CMD_START is emitted BEFORE execution so the agent can distinguish
        'command not received' from 'cmdlet hanging'. CMD_END is outside
        try/catch so it always fires regardless of success/error.
        """
        return (
            f'[Console]::WriteLine("{self.CMD_START_MARKER}")\n'
            f"[Console]::Out.Flush()\n"
            f"try {{\n"
            f"    $__data = ({cmd_text} | ConvertTo-Json -Depth 10 -Compress)\n"
            f"    $__json = (@{{ 'name'='{cmd_name}'; 'success'=$true; 'data'=$__data }} | ConvertTo-Json -Compress)\n"
            f"    [Console]::WriteLine($__json)\n"
            f"}} catch {{\n"
            f"    $__json = (@{{ 'name'='{cmd_name}'; 'success'=$false; 'error'=$_.Exception.Message }} | ConvertTo-Json -Compress)\n"
            f"    [Console]::WriteLine($__json)\n"
            f"}}\n"
            f'[Console]::WriteLine("{self.CMD_END_MARKER}")\n'
            f"[Console]::Out.Flush()\n"
        )
    
    def _sanitize_line(self, line: str) -> str:
        """Remove BOM, ANSI escapes, null bytes, CR and all non-printable chars."""
        line = line.replace('\ufeff', '')   # UTF-8 BOM
        line = line.replace('\x00', '')     # Null bytes
        line = line.replace('\r', '')       # Carriage return
        line = self.ANSI_ESCAPE_RE.sub('', line)  # ANSI escape sequences
        # Remove ALL non-printable characters
        line = ''.join(c for c in line if c.isprintable() or c in ('\n', '\t'))
        return line.strip()

    def _start_reader_thread(self, stdout) -> queue.Queue:
        """
        Spawn a daemon thread that reads stdout.readline() in a loop and
        puts each line into a Queue. When EOF is reached, puts None as sentinel.
        This allows the main thread to use queue.get(timeout=...) which
        properly respects timeouts even when readline() would block forever.
        """
        q: queue.Queue = queue.Queue()

        def _reader():
            try:
                for line in iter(stdout.readline, ''):
                    self.logger.info(f"[PS raw] {repr(line)}")
                    q.put(line)
            except Exception as e:
                self.logger.warning(f"Reader thread error: {e}")
            q.put(None)  # EOF sentinel

        t = threading.Thread(target=_reader, daemon=True)
        t.start()
        return q

    def _read_until_marker(self, read_queue: queue.Queue, marker: str, timeout: int, max_timeout: int = 600):
        """
        Read lines from the reader queue until a marker line is found, with activity-based timeout.
        The per-line deadline resets on every received line (process is alive),
        but an absolute cap (max_timeout) prevents infinite waits.
        Returns a tuple (found: bool, output: str).
        - found=True, output=accumulated lines when marker is found
        - found=False, output=accumulated lines on timeout/EOF (for diagnostics)
        """
        lines = []
        start = time.time()
        abs_deadline = start + max_timeout   # Hard cap (default 10 min)
        deadline = start + timeout           # Dynamic per-activity deadline

        while True:
            remaining = min(deadline, abs_deadline) - time.time()
            if remaining <= 0:
                return (False, "\n".join(lines))
            try:
                line = read_queue.get(timeout=remaining)
            except queue.Empty:
                return (False, "\n".join(lines))
            if line is None:
                # EOF - process died
                return (False, "\n".join(lines))
            line_clean = self._sanitize_line(line)
            if marker in line_clean or line_clean == marker:
                return (True, "\n".join(lines))
            lines.append(line_clean)
            # Reset deadline on activity (output received = process is alive)
            deadline = time.time() + timeout
    
    def _build_script_file(
        self,
        module: str,
        cmd_list: List[Dict[str, Any]],
        app_id: str,
        tenant_id: str,
        organization: Optional[str] = None,
        auth_mode: str = "cba",
        username: Optional[str] = None,
        password: Optional[str] = None,
    ) -> Path:
        """
        Build a temporary .ps1 script file containing the full preamble + all commands.
        Used with `pwsh -File` to avoid stdin pipe deadlocks with Exchange cmdlets.
        Returns the path to the temporary script file.
        """
        module_config = self.MODULES[module]

        if not organization:
            organization = f"{tenant_id}"

        lines = [
            "# Auto-generated by iScope Agent - do not edit",
            '[Console]::WriteLine("---ISCOPE_PIPE_TEST---")',
            "[Console]::Out.Flush()",
            "",
            "$ErrorActionPreference = 'Continue'",
            "$ProgressPreference = 'SilentlyContinue'",
            "$env:HOME = '/var/lib/iscope-agent'",
            "",
            module_config["import"],
            "",
        ]

        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            escaped_password = password.replace('"', '`"').replace("'", "`'").replace('$', '`$')
            lines.extend([
                f'$secPassword = ConvertTo-SecureString "{escaped_password}" -AsPlainText -Force',
                f'$cred = New-Object System.Management.Automation.PSCredential("{username}", $secPassword)',
                module_config["connect_credential"].format(tenant_id=tenant_id, spo_admin_domain=(organization or '').replace('.onmicrosoft.com', '').split('.')[0]),
            ])
        else:
            spo_admin_domain = (organization or '').replace('.onmicrosoft.com', '').split('.')[0]
            thumbprint = self._get_thumbprint() or ''
            lines.extend([
                module_config["connect_cba"].format(
                    app_id=app_id,
                    cert_path=str(self.PFX_FILE),
                    tenant_id=tenant_id,
                    organization=organization,
                    spo_admin_domain=spo_admin_domain,
                    thumbprint=thumbprint
                ),
            ])

        lines.extend([
            "",
            f'[Console]::WriteLine("{self.SESSION_READY_MARKER}")',
            "[Console]::Out.Flush()",
            "",
        ])

        # Add each command wrapped with markers
        for cmd_info in cmd_list:
            cmd_name = cmd_info['name']
            cmd_text = cmd_info['command']
            lines.append(self._build_interactive_command(cmd_name, cmd_text))

        # Disconnect at the end
        disconnect_cmd = module_config.get("disconnect", "")
        if disconnect_cmd:
            lines.append(disconnect_cmd)

        # Write to temp file
        cwd = str(self.CERT_DIR) if auth_mode == self.AUTH_MODE_CBA and self.CERT_DIR.exists() else '/tmp'
        script_file = tempfile.NamedTemporaryFile(
            mode='w', suffix='.ps1', delete=False, dir=cwd,
            encoding='utf-8',
        )
        script_file.write("\n".join(lines))
        script_file.close()
        self.logger.info(f"Script file written: {script_file.name} ({len(lines)} lines)")
        return Path(script_file.name)
    
    def run_interactive(
        self,
        steps: List[Dict[str, Any]],
        context: Dict[str, Any],
        report_callback: Callable
    ) -> List[Dict[str, Any]]:
        """
        Execute PowerShell commands progressively in an interactive session.
        
        Opens a single PowerShell process, sends commands one by one via stdin,
        reads results from stdout, and calls report_callback immediately for each.
        
        Args:
            steps: List of step configurations (each with params.commands)
            context: Execution context with credentials
            report_callback: Function(step_id, status, data, error, duration_ms) called per step
            
        Returns:
            List of step result dicts [{step_id, status, error, duration_ms}, ...]
        """
        # Extract connection params from first step
        first_params = steps[0].get('params', {})
        module = first_params.get('module', 'ExchangeOnline')
        app_id = first_params.get('app_id') or context.get('app_id') or ''
        tenant_id = first_params.get('tenant_id') or context.get('tenant_id') or ''
        organization = first_params.get('organization') or context.get('organization')
        auth_mode = first_params.get('auth_mode', self.AUTH_MODE_CBA)
        username = first_params.get('username')
        password = first_params.get('password')
        
        # Check prerequisites
        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            pwsh = self._find_pwsh()
            if not pwsh:
                error = "PowerShell Core (pwsh) not found"
                return self._fail_all_steps(steps, error, report_callback)
        else:
            prereq = self._check_prerequisites()
            if prereq.get("error"):
                return self._fail_all_steps(steps, prereq["error"], report_callback)
            pwsh = prereq["pwsh_path"]
        
        # Build command list from steps
        cmd_list = []
        for step in steps:
            step_params = step.get('params', {})
            cmds = step_params.get('commands', [])
            cmd_timeout = step_params.get('timeout', 120)
            if isinstance(cmd_timeout, (int, float)) and cmd_timeout > 0:
                cmd_timeout = int(cmd_timeout)
            else:
                cmd_timeout = 120
            
            if cmds:
                cmd = cmds[0]
                cmd_list.append({
                    'step_id': step.get('id', 'unknown'),
                    'name': cmd.get('name', 'unknown'),
                    'command': cmd.get('command', ''),
                    'timeout': cmd_timeout,
                })
        
        # Resolve placeholders in command text using context values
        for cmd_info in cmd_list:
            cmd_text = cmd_info['command']
            for key in ('period_start', 'period_end'):
                placeholder = '{' + key + '}'
                if placeholder in cmd_text and key in context:
                    cmd_text = cmd_text.replace(placeholder, context[key])
            cmd_info['command'] = cmd_text
        
        self.logger.info(
            f"PowerShell interactive: module={module}, {len(cmd_list)} commands, "
            f"auth={auth_mode}"
        )
        
        # Build script file with all commands
        script_path = None
        env = os.environ.copy()
        env["HOME"] = "/var/lib/iscope-agent"
        env["PYTHONIOENCODING"] = "utf-8"
        env["DOTNET_SYSTEM_CONSOLE_ALLOW_ANSI_COLOR_REDIRECTION"] = "0"
        cwd = str(self.CERT_DIR) if auth_mode == self.AUTH_MODE_CBA and self.CERT_DIR.exists() else None
        
        try:
            script_path = self._build_script_file(
                module=module,
                cmd_list=cmd_list,
                app_id=app_id,
                tenant_id=tenant_id,
                organization=organization,
                auth_mode=auth_mode,
                username=username,
                password=password,
            )
        except Exception as e:
            error = f"Failed to build script file: {e}"
            self.logger.error(error)
            return self._fail_all_steps(steps, error, report_callback)
        
        try:
            proc = subprocess.Popen(
                [pwsh, "-NoProfile", "-NonInteractive", "-File", str(script_path)],
                stdin=subprocess.DEVNULL,  # No stdin! Eliminates Exchange cmdlet deadlock
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                cwd=cwd,
                env=env,
                bufsize=1,  # Line-buffered
            )
        except Exception as e:
            error = f"Failed to start PowerShell: {e}"
            self.logger.error(error)
            return self._fail_all_steps(steps, error, report_callback)
        
        step_results = []
        read_queue = self._start_reader_thread(proc.stdout)
        
        try:
            # Wait for session ready (connection timeout: 120s)
            self.logger.info("Waiting for PowerShell session to connect...")
            found, conn_output = self._read_until_marker(read_queue, self.SESSION_READY_MARKER, timeout=120)
            
            if not found:
                error = "PowerShell session failed to connect within 120s"
                if conn_output:
                    self.logger.error(f"PowerShell output during connection:\n{conn_output[:2000]}")
                try:
                    proc.kill()
                    proc.communicate(timeout=5)
                except Exception:
                    pass
                self.logger.error(error)
                return self._fail_all_steps(steps, error, report_callback)
            
            self.logger.info("PowerShell session connected successfully")
            
            # Read commands progressively (all commands are already in the script)
            consecutive_timeouts = 0
            
            for cmd_info in cmd_list:
                step_id = cmd_info['step_id']
                cmd_name = cmd_info['name']
                cmd_text = cmd_info['command']
                cmd_timeout = cmd_info['timeout']
                
                if not cmd_text:
                    sr = {'step_id': step_id, 'status': 'failed', 'error': 'Empty command', 'duration_ms': 0}
                    step_results.append(sr)
                    report_callback(step_id, 'failed', None, 'Empty command', 0)
                    continue
                
                # Note: we do NOT check proc.poll() here because with -File mode
                # PowerShell may finish executing all commands before Python reads
                # all results from the queue. The reader thread buffers everything,
                # and _read_until_marker handles EOF gracefully.
                
                self.logger.info(f"Executing command: {cmd_name} (timeout={cmd_timeout}s)")
                cmd_start = time.time()
                
                # Read until CMD_START marker (command is already in the script, just read output)
                start_found, pre_output = self._read_until_marker(read_queue, self.CMD_START_MARKER, timeout=cmd_timeout)
                
                if not start_found:
                    duration = int((time.time() - cmd_start) * 1000)
                    error = f"Command timed out after {cmd_timeout}s"
                    self.logger.warning(f"Command {cmd_name}: {error}")
                    sr = {'step_id': step_id, 'status': 'failed', 'error': error, 'duration_ms': duration}
                    step_results.append(sr)
                    report_callback(step_id, 'failed', None, error, duration)
                    
                    consecutive_timeouts += 1
                    if consecutive_timeouts >= self.MAX_CONSECUTIVE_TIMEOUTS:
                        self.logger.error(
                            f"{consecutive_timeouts} consecutive timeouts - killing session"
                        )
                        try:
                            proc.kill()
                            proc.communicate(timeout=5)
                        except Exception:
                            pass
                        remaining = [c for c in cmd_list if c['step_id'] not in {r['step_id'] for r in step_results}]
                        for rem in remaining:
                            sr2 = {'step_id': rem['step_id'], 'status': 'failed',
                                   'error': 'Session killed after consecutive timeouts', 'duration_ms': 0}
                            step_results.append(sr2)
                            report_callback(rem['step_id'], 'failed', None, sr2['error'], 0)
                        break
                    continue
                
                # CMD_START found, now read the JSON payload until CMD_END
                remaining_timeout = max(30, cmd_timeout - int(time.time() - cmd_start))
                end_found, json_output = self._read_until_marker(read_queue, self.CMD_END_MARKER, timeout=remaining_timeout)
                
                duration = int((time.time() - cmd_start) * 1000)
                
                if not end_found:
                    error = f"Command output timed out after producing start marker"
                    self.logger.warning(f"Command {cmd_name}: {error}")
                    sr = {'step_id': step_id, 'status': 'failed', 'error': error, 'duration_ms': duration}
                    step_results.append(sr)
                    report_callback(step_id, 'failed', None, error, duration)
                    consecutive_timeouts += 1
                    if consecutive_timeouts >= self.MAX_CONSECUTIVE_TIMEOUTS:
                        self.logger.error(f"{consecutive_timeouts} consecutive timeouts - killing session")
                        try:
                            proc.kill()
                            proc.communicate(timeout=5)
                        except Exception:
                            pass
                        remaining = [c for c in cmd_list if c['step_id'] not in {r['step_id'] for r in step_results}]
                        for rem in remaining:
                            sr2 = {'step_id': rem['step_id'], 'status': 'failed',
                                   'error': 'Session killed after consecutive timeouts', 'duration_ms': 0}
                            step_results.append(sr2)
                            report_callback(rem['step_id'], 'failed', None, sr2['error'], 0)
                        break
                    continue
                
                # Reset consecutive timeout counter on success
                consecutive_timeouts = 0
                
                # Parse JSON result
                step_status, step_data, step_error = self._parse_interactive_result(cmd_name, json_output)
                
                sr = {'step_id': step_id, 'status': step_status, 'error': step_error, 'duration_ms': duration}
                step_results.append(sr)
                report_callback(step_id, step_status, step_data, step_error, duration)
                
                self.logger.info(f"Command {cmd_name}: {step_status} ({duration}ms)")
            
            # Process ends naturally after script completes
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
            
        except Exception as e:
            self.logger.error(f"Interactive session error: {e}")
            reported_ids = {r['step_id'] for r in step_results}
            for cmd_info in cmd_list:
                if cmd_info['step_id'] not in reported_ids:
                    sr = {'step_id': cmd_info['step_id'], 'status': 'failed',
                          'error': f'Session error: {e}', 'duration_ms': 0}
                    step_results.append(sr)
                    report_callback(cmd_info['step_id'], 'failed', None, sr['error'], 0)
            
            try:
                proc.kill()
                proc.communicate(timeout=5)
            except Exception:
                pass
        finally:
            # Cleanup temp script file
            if script_path:
                try:
                    script_path.unlink(missing_ok=True)
                except Exception:
                    pass
        
        return step_results
    
    def _parse_interactive_result(self, cmd_name: str, json_output: str):
        """Parse the JSON output from an interactive command. Returns (status, data, error)."""
        text = json_output.strip()
        try:
            result = json.loads(text)
        except json.JSONDecodeError:
            # Fallback: find first line that is valid JSON (handles PS WARNING lines before payload)
            result = None
            for line in text.splitlines():
                line = line.strip()
                if not line or not (line.startswith('{') or line.startswith('[')):
                    continue
                try:
                    result = json.loads(line)
                    self.logger.info(f"[{cmd_name}] Recovered JSON after skipping non-JSON lines")
                    break
                except json.JSONDecodeError:
                    continue
            if result is None:
                return ('failed', None, f"Invalid JSON output: no parseable JSON found in {len(text)} chars")
        
        if not isinstance(result, dict):
            return ('success', result, None)
        
        if result.get('success') is False:
            error_text = result.get('error', 'Command failed')
            # Detect unlicensed cmdlets as not_applicable
            if 'is not recognized as a name of a cmdlet' in error_text:
                return ('not_applicable', None, f"Cmdlet nao disponivel (licenca ausente): {error_text[:150]}")
            return ('failed', None, error_text)
        
        # Parse nested JSON data
        raw_data = result.get('data')
        if isinstance(raw_data, str):
            try:
                parsed_data = json.loads(raw_data)
            except (json.JSONDecodeError, ValueError):
                parsed_data = raw_data
        else:
            parsed_data = raw_data
        
        return ('success', parsed_data, None)
    
    # _close_interactive_session removed: with -File mode, process ends naturally after script completes
    
    def _fail_all_steps(self, steps, error, report_callback):
        """Mark all steps as failed and report them."""
        results = []
        for step in steps:
            step_id = step.get('id', 'unknown')
            sr = {'step_id': step_id, 'status': 'failed', 'error': error, 'duration_ms': 0}
            results.append(sr)
            report_callback(step_id, 'failed', None, error, 0)
        return results
    
    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute PowerShell commands in batch mode (legacy).
        Used for single commands, RBAC setup, and fallback.
        """
        params = step.get("params", {})
        
        auth_mode = params.get("auth_mode", self.AUTH_MODE_CBA)
        
        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            pwsh = self._find_pwsh()
            if not pwsh:
                return {"error": "PowerShell Core (pwsh) not found. Install with: sudo apt install -y powershell"}
            pwsh_path = pwsh
        else:
            prereq = self._check_prerequisites()
            if prereq.get("error"):
                self.logger.error(f"PowerShell prerequisites not met: {prereq['error']}")
                return {"error": prereq["error"]}
            pwsh_path = prereq["pwsh_path"]
        
        module = params.get("module", "ExchangeOnline")
        commands = params.get("commands", [])
        app_id = params.get("app_id") or context.get("app_id")
        tenant_id = params.get("tenant_id") or context.get("tenant_id")
        organization = params.get("organization") or context.get("organization")
        default_timeout = 300 + (max(0, len(commands) - 1) * 30)
        timeout = params.get("timeout", default_timeout)
        username = params.get("username")
        password = params.get("password")
        
        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            if not username or not password:
                return {"error": "username and password are required for credential-based authentication"}
            if not tenant_id:
                return {"error": "tenant_id is required"}
        else:
            if not app_id:
                return {"error": "app_id is required"}
            if not tenant_id:
                return {"error": "tenant_id is required"}
        
        if not commands:
            return {"error": "commands list is required"}
        
        self.logger.info(f"Executing PowerShell {module} commands ({auth_mode} auth): {[c.get('name', 'unknown') for c in commands]}")
        
        try:
            script = self._build_script(
                module=module,
                commands=commands,
                app_id=app_id or "",
                tenant_id=tenant_id,
                organization=organization,
                auth_mode=auth_mode,
                username=username,
                password=password
            )
            
            self.logger.debug(f"PowerShell script built, {len(script)} chars")
            
            cwd = str(self.CERT_DIR) if auth_mode == self.AUTH_MODE_CBA else None
            
            script_file = None
            try:
                script_file = tempfile.NamedTemporaryFile(
                    mode='w', suffix='.ps1', delete=False, dir=cwd or '/tmp'
                )
                script_file.write(script)
                script_file.close()

                env = os.environ.copy()
                env["HOME"] = "/var/lib/iscope-agent"

                result = subprocess.run(
                    [pwsh_path, "-NoProfile", "-NonInteractive", "-File", script_file.name],
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                    cwd=cwd,
                    env=env
                )
            finally:
                if script_file:
                    try:
                        os.unlink(script_file.name)
                    except OSError:
                        pass
            
            if result.returncode != 0:
                error_msg = result.stderr.strip() if result.stderr else f"Exit code: {result.returncode}"
                self.logger.error(f"PowerShell execution failed: {error_msg}")
                return {"error": error_msg, "exit_code": result.returncode}
            
            output = result.stdout.strip()
            if not output:
                return {"error": "No output from PowerShell script"}
            
            marker = '---ISCOPE_JSON_START---'
            if marker in output:
                output = output.split(marker, 1)[1].strip()
            
            try:
                data = json.loads(output)
                self.logger.info(f"PowerShell execution successful, {len(data)} results")
                return {"data": data}
            except json.JSONDecodeError as e:
                self.logger.warning(f"Failed to parse PowerShell output as JSON: {e}")
                return {"data": output, "raw": True}
            
        except subprocess.TimeoutExpired:
            self.logger.error(f"PowerShell execution timed out after {timeout}s")
            return {"error": f"Execution timed out after {timeout} seconds"}
        except Exception as e:
            self.logger.error(f"PowerShell execution error: {e}")
            return {"error": str(e)}
    
    @classmethod
    def is_available(cls) -> bool:
        """Check if PowerShell executor is available on this system."""
        pwsh = shutil.which("pwsh")
        pfx_exists = cls.PFX_FILE.exists()
        return pwsh is not None and pfx_exists
    
    @classmethod
    def get_capabilities(cls) -> List[str]:
        """Return list of capabilities this executor provides."""
        capabilities = []
        
        if shutil.which("pwsh"):
            capabilities.append("powershell")
            
            if cls.PFX_FILE.exists():
                capabilities.append("m365_powershell")
        
        return capabilities
