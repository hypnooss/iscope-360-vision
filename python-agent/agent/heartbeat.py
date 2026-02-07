from agent.version import get_version
from agent.auth import get_certificate_thumbprint, get_certificate_public_key, CERT_FILE


class AgentStopped(Exception):
    pass


class AgentHeartbeat:
    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger

    def _get_pending_certificate(self):
        """Check if there's a certificate that needs to be uploaded to Azure."""
        # No certificate file exists
        if not CERT_FILE.exists():
            return None
        
        # Certificate already registered in Azure
        if self.state.data.get("azure_certificate_key_id"):
            return None
        
        thumbprint = get_certificate_thumbprint()
        public_key = get_certificate_public_key()
        
        if thumbprint and public_key:
            self.logger.info(f"Certificado pendente detectado: {thumbprint[:8]}...")
            return {
                "certificate_thumbprint": thumbprint,
                "certificate_public_key": public_key
            }
        
        return None

    def send(self, status="running", version=None):
        if version is None:
            version = get_version()
        self.logger.info(f"Enviando heartbeat (v{version})")

        try:
            # Build heartbeat payload
            payload = {
                "status": status,
                "agent_version": version
            }
            
            # Include pending certificate if exists
            pending_cert = self._get_pending_certificate()
            if pending_cert:
                payload.update(pending_cert)
                self.logger.info("Incluindo certificado no heartbeat para upload ao Azure")
            
            response = self.api.post(
                "/agent-heartbeat",
                json=payload
            )
            
            # Check if certificate was registered
            if pending_cert and response.get("azure_certificate_key_id"):
                self.state.data["azure_certificate_key_id"] = response["azure_certificate_key_id"]
                self.state.save()
                self.logger.info(f"Certificado registrado no Azure: {response['azure_certificate_key_id']}")
            
            return response

        except RuntimeError as e:
            msg = str(e)
            self.logger.warning(f"Heartbeat falhou: {msg}")

            # APIClient já extraiu o error string
            if "TOKEN_EXPIRED" in msg:
                self.logger.info("Access token expirado, tentando refresh")
                # Re-raise to trigger refresh in the main loop
                raise

            if "BLOCKED" in msg or "REVOKED" in msg:
                self.logger.critical("Agent bloqueado ou revogado pelo backend")
                raise AgentStopped(msg)

            if "INVALID_TOKEN" in msg:
                self.logger.critical("Token inválido. Limpando estado local.")
                self.state.data.clear()
                self.state.save()
                raise AgentStopped(msg)

            if "INVALID_SIGNATURE" in msg:
                # This is a genuine signature mismatch - jwt_secret changed
                self.logger.critical("Assinatura JWT inválida. Re-registro necessário.")
                self.state.data.clear()
                self.state.save()
                raise AgentStopped(msg)

            raise
