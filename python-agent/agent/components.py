"""
System Components Manager - Handles automatic installation of system dependencies.

This module provides a generic framework for checking and installing system
components that the agent requires. New components can be added by implementing
check and install functions and adding them to the COMPONENTS list.

Supported Components:
- PowerShell Core 7.x
- M365 PowerShell Modules (ExchangeOnlineManagement, Microsoft.Graph.Authentication)
- M365 Certificate (self-signed RSA-2048 for CBA authentication)
"""

import os
import platform
import shutil
import socket
import subprocess
from pathlib import Path
from typing import Callable, List, Tuple


class ComponentManager:
    """Manages system component verification and installation."""

    # Standard paths
    CERT_DIR = Path("/var/lib/iscope-agent/certs")
    CERT_FILE = CERT_DIR / "m365.crt"
    KEY_FILE = CERT_DIR / "m365.key"
    THUMBPRINT_FILE = CERT_DIR / "m365.thumbprint"
    PFX_FILE = CERT_DIR / "m365.pfx"

    def __init__(self, logger):
        self.logger = logger

    def ensure_components(self) -> None:
        """
        Check and install all missing system components.
        
        This method iterates through all registered components, checks if they
        are installed, and installs them if missing. Failures are logged but
        do not stop the process.
        """
        # Check if we have root privileges for installation
        if os.geteuid() != 0:
            self.logger.warning(
                "Componentes do sistema requerem root. "
                "Execute 'agent-install --update' manualmente para instalar."
            )
            return

        self.logger.info("Verificando componentes do sistema...")

        components: List[Tuple[str, Callable[[], bool], Callable[[], None]]] = [
            ("PowerShell Core", self._check_powershell, self._install_powershell),
            ("Módulos M365", self._check_m365_modules, self._install_m365_modules),
            ("Certificado M365", self._check_m365_certificate, self._generate_m365_certificate),
        ]

        for name, check_fn, install_fn in components:
            try:
                if not check_fn():
                    self.logger.info(f"Componente ausente: {name}. Instalando...")
                    install_fn()
                    self.logger.info(f"{name} instalado com sucesso")
                else:
                    self.logger.debug(f"Componente OK: {name}")
            except Exception as e:
                self.logger.warning(f"Falha ao instalar {name}: {e}")

    # =========================================================================
    # OS Detection
    # =========================================================================

    def _detect_os(self) -> str:
        """
        Detect the Linux distribution.
        
        Returns:
            OS identifier: ubuntu, debian, rhel, centos, rocky, almalinux, ol, or unknown
        """
        os_release = Path("/etc/os-release")
        if os_release.exists():
            content = os_release.read_text()
            for line in content.splitlines():
                if line.startswith("ID="):
                    os_id = line.split("=")[1].strip().strip('"').lower()
                    return os_id
        return "unknown"

    def _get_os_version(self) -> str:
        """Get OS major version number."""
        os_release = Path("/etc/os-release")
        if os_release.exists():
            content = os_release.read_text()
            for line in content.splitlines():
                if line.startswith("VERSION_ID="):
                    version = line.split("=")[1].strip().strip('"')
                    # Return major version only
                    return version.split(".")[0]
        return "0"

    # =========================================================================
    # PowerShell Core
    # =========================================================================

    def _check_powershell(self) -> bool:
        """Check if PowerShell Core is installed."""
        return shutil.which("pwsh") is not None

    def _install_powershell(self) -> None:
        """Install PowerShell Core based on OS detection."""
        os_id = self._detect_os()
        os_version = self._get_os_version()

        self.logger.info(f"Detectado OS: {os_id} {os_version}")

        if os_id in ("ubuntu", "debian"):
            self._install_powershell_debian()
        elif os_id in ("rhel", "centos", "rocky", "almalinux", "ol"):
            self._install_powershell_rhel()
        else:
            raise RuntimeError(f"OS não suportado para instalação do PowerShell: {os_id}")

    def _install_powershell_debian(self) -> None:
        """Install PowerShell on Debian/Ubuntu."""
        # Install prerequisites
        subprocess.run(
            ["apt-get", "update"],
            check=True, capture_output=True
        )
        subprocess.run(
            ["apt-get", "install", "-y", "wget", "apt-transport-https", "software-properties-common"],
            check=True, capture_output=True
        )

        # Get Ubuntu/Debian codename
        os_id = self._detect_os()
        codename = self._get_debian_codename()

        # Download and register Microsoft GPG key
        subprocess.run(
            ["wget", "-q", "https://packages.microsoft.com/keys/microsoft.asc", "-O-"],
            stdout=subprocess.PIPE, check=True
        )
        
        # Add Microsoft repository
        repo_url = f"https://packages.microsoft.com/{os_id}/{codename}/prod"
        sources_list = Path(f"/etc/apt/sources.list.d/microsoft-prod.list")
        
        # Download and install packages.microsoft.com GPG key
        subprocess.run([
            "bash", "-c",
            "wget -q https://packages.microsoft.com/keys/microsoft.asc -O- | gpg --dearmor > /usr/share/keyrings/microsoft.gpg"
        ], check=True, capture_output=True)

        # Write repository configuration
        sources_list.write_text(
            f"deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] {repo_url} main\n"
        )

        # Update and install PowerShell
        subprocess.run(["apt-get", "update"], check=True, capture_output=True)
        subprocess.run(
            ["apt-get", "install", "-y", "powershell"],
            check=True, capture_output=True
        )

    def _get_debian_codename(self) -> str:
        """Get Debian/Ubuntu version codename."""
        os_release = Path("/etc/os-release")
        if os_release.exists():
            content = os_release.read_text()
            for line in content.splitlines():
                if line.startswith("VERSION_CODENAME="):
                    return line.split("=")[1].strip().strip('"')
        # Fallback
        return "jammy"

    def _install_powershell_rhel(self) -> None:
        """Install PowerShell on RHEL/CentOS/Rocky/AlmaLinux/Oracle Linux."""
        os_version = self._get_os_version()

        # Register Microsoft repository
        repo_url = f"https://packages.microsoft.com/rhel/{os_version}/prod/"
        
        subprocess.run([
            "bash", "-c",
            f"curl -sSL https://packages.microsoft.com/keys/microsoft.asc | tee /etc/pki/rpm-gpg/microsoft.asc"
        ], check=True, capture_output=True)

        repo_file = Path("/etc/yum.repos.d/microsoft.repo")
        repo_file.write_text(f"""[microsoft]
name=Microsoft Repository
baseurl={repo_url}
enabled=1
gpgcheck=1
gpgkey=file:///etc/pki/rpm-gpg/microsoft.asc
""")

        # Install PowerShell using dnf or yum
        pkg_manager = "dnf" if shutil.which("dnf") else "yum"
        subprocess.run(
            [pkg_manager, "install", "-y", "powershell"],
            check=True, capture_output=True
        )

    # =========================================================================
    # M365 PowerShell Modules
    # =========================================================================

    def _check_m365_modules(self) -> bool:
        """Check if M365 PowerShell modules are installed."""
        if not self._check_powershell():
            # Skip module check if PowerShell is not installed
            return True

        result = subprocess.run(
            [
                "pwsh", "-NoProfile", "-NonInteractive", "-Command",
                "if ((Get-Module -ListAvailable ExchangeOnlineManagement) -and "
                "(Get-Module -ListAvailable Microsoft.Graph.Authentication) -and "
                "(Get-Module -ListAvailable PnP.PowerShell)) { exit 0 } else { exit 1 }"
            ],
            capture_output=True
        )
        return result.returncode == 0

    def _install_m365_modules(self) -> None:
        """Install M365 PowerShell modules."""
        if not self._check_powershell():
            self.logger.warning("PowerShell não instalado, pulando módulos M365")
            return

        # Install modules globally
        install_cmd = (
            "Set-PSRepository -Name PSGallery -InstallationPolicy Trusted; "
            "Install-Module -Name ExchangeOnlineManagement -Scope AllUsers -Force -AllowClobber; "
            "Install-Module -Name Microsoft.Graph.Authentication -Scope AllUsers -Force -AllowClobber; "
            "Install-Module -Name PnP.PowerShell -Scope AllUsers -Force -AllowClobber"
        )

        result = subprocess.run(
            ["pwsh", "-NoProfile", "-NonInteractive", "-Command", install_cmd],
            capture_output=True,
            timeout=600  # 10 minutes timeout for module installation
        )

        if result.returncode != 0:
            stderr = result.stderr.decode() if result.stderr else ""
            raise RuntimeError(f"Falha ao instalar módulos M365: {stderr}")

    # =========================================================================
    # M365 Certificate
    # =========================================================================

    def _check_m365_certificate(self) -> bool:
        """Check if M365 certificate exists and is valid."""
        if not self.CERT_FILE.exists() or not self.KEY_FILE.exists():
            return False

        # Check if certificate is still valid (not expired)
        try:
            result = subprocess.run(
                ["openssl", "x509", "-in", str(self.CERT_FILE), "-checkend", "86400"],
                capture_output=True
            )
            return result.returncode == 0
        except Exception:
            return False

    def _generate_m365_certificate(self) -> None:
        """Generate M365 self-signed certificate for CBA authentication."""
        # Create certificate directory
        self.CERT_DIR.mkdir(parents=True, exist_ok=True)

        # Get hostname for certificate CN
        hostname = socket.gethostname()

        # Generate RSA-2048 certificate valid for 2 years
        subprocess.run([
            "openssl", "req", "-x509",
            "-newkey", "rsa:2048",
            "-keyout", str(self.KEY_FILE),
            "-out", str(self.CERT_FILE),
            "-sha256",
            "-days", "730",
            "-nodes",
            "-subj", f"/CN=iScope-Agent-{hostname}/O=iScope 360"
        ], check=True, capture_output=True)

        # Set secure permissions
        os.chmod(self.KEY_FILE, 0o600)
        os.chmod(self.CERT_FILE, 0o644)

        # Calculate and save thumbprint (SHA1 fingerprint)
        result = subprocess.run(
            ["openssl", "x509", "-in", str(self.CERT_FILE), "-fingerprint", "-sha1", "-noout"],
            capture_output=True, check=True
        )
        # Output format: SHA1 Fingerprint=XX:XX:XX:...
        fingerprint = result.stdout.decode().strip().split("=")[1].replace(":", "").upper()
        self.THUMBPRINT_FILE.write_text(fingerprint)

        self.logger.info(f"Certificado M365 gerado com thumbprint: {fingerprint}")


def ensure_system_components(logger) -> None:
    """
    Convenience function to check and install all system components.
    
    Args:
        logger: Logger instance for output
    """
    manager = ComponentManager(logger)
    manager.ensure_components()
