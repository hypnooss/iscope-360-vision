import os
import jwt
import time
import sys
from pathlib import Path


# Certificate paths for M365 PowerShell authentication
CERT_DIR = Path("/var/lib/iscope-agent/certs")
THUMBPRINT_FILE = CERT_DIR / "thumbprint.txt"
CERT_FILE = CERT_DIR / "m365.crt"


def get_certificate_thumbprint():
    """Read certificate thumbprint from file if available.
    
    Sanitizes the thumbprint to ensure Azure compatibility:
    - Removes common OpenSSL prefixes (sha1 Fingerprint=, SHA1 Fingerprint=, etc.)
    - Removes colons (AA:BB:CC -> AABBCC)
    """
    if THUMBPRINT_FILE.exists():
        raw = THUMBPRINT_FILE.read_text().strip()
        # Remove prefixes like "sha1 Fingerprint=", "SHA1 Fingerprint=", etc.
        if '=' in raw:
            raw = raw.split('=', 1)[-1]
        # Remove colons (AA:BB:CC:DD -> AABBCCDD)
        return raw.replace(':', '').strip().upper()
    return None


def get_certificate_public_key():
    """Read certificate public key (PEM content) for upload to Azure."""
    if CERT_FILE.exists():
        return CERT_FILE.read_text().strip()
    return None


def get_agent_capabilities():
    """Detect available capabilities on this agent."""
    import shutil
    
    capabilities = ["http"]  # Always available
    
    # Check SSH (paramiko)
    try:
        import paramiko
        capabilities.append("ssh")
    except ImportError:
        pass
    
    # Check SNMP
    try:
        import pysnmp
        capabilities.append("snmp")
    except ImportError:
        pass
    
    # Check DNS
    try:
        import dns.resolver
        capabilities.append("dns")
    except ImportError:
        pass
    
    # Check Amass
    if shutil.which("amass") or Path("/usr/local/bin/amass").exists():
        capabilities.append("amass")
    
    # Check PowerShell
    if shutil.which("pwsh"):
        capabilities.append("powershell")
        
        # Check M365 certificate
        if CERT_FILE.exists() and THUMBPRINT_FILE.exists():
            capabilities.append("m365_powershell")
    
    return capabilities


class AuthManager:
    def __init__(self, state, api_client, logger):
        self.state = state
        self.api = api_client
        self.logger = logger

    def is_access_token_valid(self):
        token = self.state.data.get("access_token")
        if not token:
            return False

        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            exp = payload.get("exp", 0)
            # Add 60 second buffer to prevent race conditions
            # Refresh if token expires in less than 60 seconds
            return exp > (time.time() + 60)
        except Exception:
            self.logger.warning("Falha ao decodificar access token")
            return False

    def register_if_needed(self):
        if self.state.is_registered():
            return

        activation_code = os.getenv("AGENT_ACTIVATION_CODE")
        if not activation_code:
            self.logger.critical(
                "Agent não registrado. Defina AGENT_ACTIVATION_CODE para ativar."
            )
            sys.exit(1)

        self.logger.info("Registrando agent no backend")

        # Collect certificate info and capabilities
        thumbprint = get_certificate_thumbprint()
        public_key = get_certificate_public_key()
        capabilities = get_agent_capabilities()
        
        self.logger.info(f"Capabilities detectadas: {capabilities}")
        if thumbprint:
            self.logger.info(f"Certificado M365 encontrado: {thumbprint[:8]}...")

        try:
            response = self.api.post(
                "/register-agent",
                json={
                    "activation_code": activation_code,
                    "certificate_thumbprint": thumbprint,
                    "certificate_public_key": public_key,
                    "capabilities": capabilities,
                }
            )
        except RuntimeError as e:
            msg = str(e)

            if msg == "ALREADY_REGISTERED":
                self.logger.critical(
                    "Activation code já consumido no backend. "
                    "Backend não entregou tokens. Corrija o backend."
                )
                sys.exit(1)

            raise

        self.state.data.update({
            "agent_id": response["agent_id"],
            "access_token": response["access_token"],
            "refresh_token": response["refresh_token"]
        })

        self.state.save()
        self.logger.info("Agent registrado com sucesso")

    def refresh_tokens(self):
        refresh_token = self.state.data.get("refresh_token")
        if not refresh_token:
            self.logger.critical("Refresh token ausente. Re-registro necessário.")
            sys.exit(1)

        self.logger.info("Renovando access token")

        response = self.api.post(
            "/agent-refresh",
            use_refresh_token=True
        )

        self.state.data.update({
            "access_token": response["access_token"],
            "refresh_token": response.get(
                "refresh_token",
                self.state.data.get("refresh_token")
            )
        })

        self.state.save()
        self.logger.info("Tokens atualizados com sucesso")

    def ensure_authenticated(self):
        self.register_if_needed()

        if not self.state.is_registered():
            sys.exit(1)

        if not self.is_access_token_valid():
            self.refresh_tokens()
