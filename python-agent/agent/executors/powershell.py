"""
PowerShell executor for M365 commands.
Uses certificate-based authentication for Exchange Online and Microsoft Graph.
"""

import json
import subprocess
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional

from agent.executors.base import BaseExecutor


class PowerShellExecutor(BaseExecutor):
    """
    Executes PowerShell commands for M365 analysis.
    Supports Exchange Online and Microsoft Graph modules.
    Supports both Certificate-Based Authentication (CBA) and Credential-based authentication.
    """
    
    CERT_DIR = Path("/var/lib/iscope-agent/certs")
    CERT_FILE = CERT_DIR / "m365.crt"
    KEY_FILE = CERT_DIR / "m365.key"
    PFX_FILE = CERT_DIR / "m365.pfx"
    THUMBPRINT_FILE = CERT_DIR / "thumbprint.txt"
    
    # Authentication modes
    AUTH_MODE_CBA = "cba"  # Certificate-Based Authentication (default)
    AUTH_MODE_CREDENTIAL = "credential"  # Username/Password (for initial RBAC setup)
    
    # Supported modules and their connection commands
    # PFX file is used for PowerShell compatibility (contains cert + private key)
    MODULES = {
        "ExchangeOnline": {
            "import": "Import-Module ExchangeOnlineManagement -ErrorAction Stop",
            # CBA connection (default)
            "connect_cba": 'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -Organization "{organization}" -ShowBanner:$false',
            # Credential-based connection (for initial RBAC setup)
            "connect_credential": 'Connect-ExchangeOnline -Credential $cred -ShowBanner:$false',
            "disconnect": "Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue",
        },
        "MicrosoftGraph": {
            "import": "Import-Module Microsoft.Graph.Authentication -ErrorAction Stop",
            "connect_cba": 'Connect-MgGraph -ClientId "{app_id}" -CertificateFilePath "{cert_path}" -CertificatePassword ([System.Security.SecureString]::new()) -TenantId "{tenant_id}" -NoWelcome',
            "connect_credential": 'Connect-MgGraph -Credential $cred -TenantId "{tenant_id}" -NoWelcome',
            "disconnect": "Disconnect-MgGraph -ErrorAction SilentlyContinue",
        },
    }

    def __init__(self, logger):
        super().__init__(logger)
        self._pwsh_path: Optional[str] = None
    
    def _find_pwsh(self) -> Optional[str]:
        """Find PowerShell Core executable."""
        if self._pwsh_path:
            return self._pwsh_path
        
        # Check common paths
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
        
        # Check pwsh
        pwsh = self._find_pwsh()
        if not pwsh:
            errors.append("PowerShell Core (pwsh) not found. Install with: sudo apt install -y powershell")
        
        # Check PFX certificate (required for PowerShell)
        if not self.PFX_FILE.exists():
            # Fallback: check if CRT/KEY exist (PFX might need regeneration)
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
        """
        Build a PowerShell script with connection, commands, and cleanup.
        
        Args:
            module: Module name (ExchangeOnline, MicrosoftGraph)
            commands: List of command configurations
            app_id: Azure App Registration ID
            tenant_id: Azure Tenant ID
            organization: Organization domain for Exchange (e.g., contoso.onmicrosoft.com)
            auth_mode: Authentication mode ('cba' for certificate, 'credential' for username/password)
            username: Admin username (required if auth_mode is 'credential')
            password: Admin password (required if auth_mode is 'credential')
        """
        if module not in self.MODULES:
            raise ValueError(f"Unsupported module: {module}. Supported: {list(self.MODULES.keys())}")
        
        module_config = self.MODULES[module]
        
        # Default organization to tenant domain if not provided
        if not organization:
            organization = f"{tenant_id}"
        
        # Build script parts
        script_parts = [
            "$ErrorActionPreference = 'Stop'",
            "$ProgressPreference = 'SilentlyContinue'",
            "",
            "# Import module",
            module_config["import"],
            "",
        ]
        
        # Add connection based on auth mode
        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            if not username or not password:
                raise ValueError("Username and password are required for credential-based authentication")
            
            # Escape special characters in password for PowerShell
            escaped_password = password.replace('"', '`"').replace("'", "`'").replace('$', '`$')
            
            script_parts.extend([
                "# Create credential object",
                f'$secPassword = ConvertTo-SecureString "{escaped_password}" -AsPlainText -Force',
                f'$cred = New-Object System.Management.Automation.PSCredential("{username}", $secPassword)',
                "",
                "# Connect with credentials",
                module_config["connect_credential"].format(
                    tenant_id=tenant_id
                ),
                "",
            ])
        else:
            # Default: CBA connection
            script_parts.extend([
                "# Connect with certificate",
                module_config["connect_cba"].format(
                    app_id=app_id,
                    cert_path=str(self.PFX_FILE),
                    tenant_id=tenant_id,
                    organization=organization
                ),
                "",
            ])
        
        # Initialize results
        script_parts.extend([
            "# Initialize results",
            "$results = @{}",
            "",
        ])
        
        # Add commands
        for cmd in commands:
            cmd_name = cmd.get("name", cmd.get("command", "unknown"))
            cmd_text = cmd.get("command", "")
            
            if not cmd_text:
                continue
            
            # Wrap each command in try/catch
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
        
        # Cleanup and output
        script_parts.extend([
            "# Disconnect",
            module_config["disconnect"],
            "",
            "# Output results as JSON",
            "$results | ConvertTo-Json -Depth 10 -Compress",
        ])
        
        return "\n".join(script_parts)
    
    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute PowerShell commands with certificate or credential authentication.
        
        Step params:
            module: str - Module to use (ExchangeOnline, MicrosoftGraph)
            commands: List[Dict] - Commands to execute
                - name: str - Result key name
                - command: str - PowerShell command
            app_id: str - Azure App ID (optional, can be in context)
            tenant_id: str - Azure Tenant ID (optional, can be in context)
            organization: str - Organization domain (optional)
            timeout: int - Command timeout in seconds (default: 300)
            auth_mode: str - Authentication mode ('cba' or 'credential', default: 'cba')
            username: str - Admin username (required if auth_mode is 'credential')
            password: str - Admin password (required if auth_mode is 'credential')
        
        Context:
            app_id: str - Azure App ID
            tenant_id: str - Azure Tenant ID
            organization: str - Organization domain
        """
        params = step.get("params", {})
        
        # Get auth mode
        auth_mode = params.get("auth_mode", self.AUTH_MODE_CBA)
        
        # For credential mode, we only need pwsh (not certificates)
        if auth_mode == self.AUTH_MODE_CREDENTIAL:
            pwsh = self._find_pwsh()
            if not pwsh:
                return {"error": "PowerShell Core (pwsh) not found. Install with: sudo apt install -y powershell"}
            pwsh_path = pwsh
        else:
            # Check prerequisites for CBA mode
            prereq = self._check_prerequisites()
            if prereq.get("error"):
                self.logger.error(f"PowerShell prerequisites not met: {prereq['error']}")
                return {"error": prereq["error"]}
            pwsh_path = prereq["pwsh_path"]
        
        # Get parameters
        module = params.get("module", "ExchangeOnline")
        commands = params.get("commands", [])
        app_id = params.get("app_id") or context.get("app_id")
        tenant_id = params.get("tenant_id") or context.get("tenant_id")
        organization = params.get("organization") or context.get("organization")
        timeout = params.get("timeout", 300)
        username = params.get("username")
        password = params.get("password")
        
        # Validate required params based on auth mode
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
            # Build script
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
            
            # Execute - use home directory for credential mode (no need for cert dir)
            cwd = str(self.CERT_DIR) if auth_mode == self.AUTH_MODE_CBA else None
            
            result = subprocess.run(
                [pwsh_path, "-NoProfile", "-NonInteractive", "-Command", script],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=cwd
            )
            
            if result.returncode != 0:
                error_msg = result.stderr.strip() if result.stderr else f"Exit code: {result.returncode}"
                self.logger.error(f"PowerShell execution failed: {error_msg}")
                return {"error": error_msg, "exit_code": result.returncode}
            
            # Parse output
            output = result.stdout.strip()
            if not output:
                return {"error": "No output from PowerShell script"}
            
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
