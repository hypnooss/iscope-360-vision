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
    """
    
    CERT_DIR = Path("/var/lib/iscope-agent/certs")
    CERT_FILE = CERT_DIR / "m365.crt"
    KEY_FILE = CERT_DIR / "m365.key"
    THUMBPRINT_FILE = CERT_DIR / "thumbprint.txt"
    
    # Supported modules and their connection commands
    MODULES = {
        "ExchangeOnline": {
            "import": "Import-Module ExchangeOnlineManagement -ErrorAction Stop",
            "connect": 'Connect-ExchangeOnline -AppId "{app_id}" -CertificateFilePath "{cert_path}" -Organization "{organization}" -ShowBanner:$false',
            "disconnect": "Disconnect-ExchangeOnline -Confirm:$false -ErrorAction SilentlyContinue",
        },
        "MicrosoftGraph": {
            "import": "Import-Module Microsoft.Graph.Authentication -ErrorAction Stop",
            "connect": 'Connect-MgGraph -ClientId "{app_id}" -CertificateFilePath "{cert_path}" -TenantId "{tenant_id}" -NoWelcome',
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
        
        # Check certificate
        if not self.CERT_FILE.exists():
            errors.append(f"Certificate not found: {self.CERT_FILE}")
        
        if not self.KEY_FILE.exists():
            errors.append(f"Private key not found: {self.KEY_FILE}")
        
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
        organization: Optional[str] = None
    ) -> str:
        """
        Build a PowerShell script with connection, commands, and cleanup.
        
        Args:
            module: Module name (ExchangeOnline, MicrosoftGraph)
            commands: List of command configurations
            app_id: Azure App Registration ID
            tenant_id: Azure Tenant ID
            organization: Organization domain for Exchange (e.g., contoso.onmicrosoft.com)
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
            "# Connect",
            module_config["connect"].format(
                app_id=app_id,
                cert_path=str(self.CERT_FILE),
                tenant_id=tenant_id,
                organization=organization
            ),
            "",
            "# Initialize results",
            "$results = @{}",
            "",
        ]
        
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
        Execute PowerShell commands with certificate authentication.
        
        Step params:
            module: str - Module to use (ExchangeOnline, MicrosoftGraph)
            commands: List[Dict] - Commands to execute
                - name: str - Result key name
                - command: str - PowerShell command
            app_id: str - Azure App ID (optional, can be in context)
            tenant_id: str - Azure Tenant ID (optional, can be in context)
            organization: str - Organization domain (optional)
            timeout: int - Command timeout in seconds (default: 300)
        
        Context:
            app_id: str - Azure App ID
            tenant_id: str - Azure Tenant ID
            organization: str - Organization domain
        """
        params = step.get("params", {})
        
        # Check prerequisites
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
        
        # Validate required params
        if not app_id:
            return {"error": "app_id is required"}
        
        if not tenant_id:
            return {"error": "tenant_id is required"}
        
        if not commands:
            return {"error": "commands list is required"}
        
        self.logger.info(f"Executing PowerShell {module} commands: {[c.get('name', 'unknown') for c in commands]}")
        
        try:
            # Build script
            script = self._build_script(
                module=module,
                commands=commands,
                app_id=app_id,
                tenant_id=tenant_id,
                organization=organization
            )
            
            self.logger.debug(f"PowerShell script built, {len(script)} chars")
            
            # Execute
            result = subprocess.run(
                [pwsh_path, "-NoProfile", "-NonInteractive", "-Command", script],
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.CERT_DIR)
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
        cert_exists = cls.CERT_FILE.exists() and cls.KEY_FILE.exists()
        return pwsh is not None and cert_exists
    
    @classmethod
    def get_capabilities(cls) -> List[str]:
        """Return list of capabilities this executor provides."""
        capabilities = []
        
        if shutil.which("pwsh"):
            capabilities.append("powershell")
            
            if cls.CERT_FILE.exists() and cls.KEY_FILE.exists():
                capabilities.append("m365_powershell")
        
        return capabilities
