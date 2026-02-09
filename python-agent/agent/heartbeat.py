from agent.version import get_version
from agent.auth import get_certificate_thumbprint, get_certificate_public_key, CERT_FILE


class AgentStopped(Exception):
    pass


class AgentHeartbeat:
    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger

    def _get_pending_certificate(self, force=False):
        """Check if there's a certificate that needs to be uploaded to Azure.
        
        Args:
            force: If True, ignores the azure_certificate_key_id state and returns
                   the certificate anyway (used when backend requests re-upload).
        """
        # No certificate file exists
        if not CERT_FILE.exists():
            return None
        
        thumbprint = get_certificate_thumbprint()
        public_key = get_certificate_public_key()
        
        if not thumbprint or not public_key:
            return None
        
        # Detect thumbprint change (certificate was regenerated)
        stored_thumbprint = self.state.data.get("registered_thumbprint")
        if stored_thumbprint and stored_thumbprint != thumbprint:
            self.logger.info(f"Thumbprint mudou: {stored_thumbprint[:8]}... -> {thumbprint[:8]}... Forcando reenvio.")
            if "azure_certificate_key_id" in self.state.data:
                del self.state.data["azure_certificate_key_id"]
                self.state.save()
            force = True
        
        # Certificate already registered in Azure (unless forced)
        if not force and self.state.data.get("azure_certificate_key_id"):
            return None
        
        self.logger.info(f"Certificado pendente detectado: {thumbprint[:8]}...")
        return {
            "certificate_thumbprint": thumbprint,
            "certificate_public_key": public_key
        }

    def send(self, status="running", version=None, force_certificate=False):
        if version is None:
            version = get_version()
        self.logger.info(f"Enviando heartbeat (v{version})")

        try:
            # Build heartbeat payload
            payload = {
                "status": status,
                "agent_version": version
            }
            
            # Include pending certificate if exists (or if forced by backend)
            pending_cert = self._get_pending_certificate(force=force_certificate)
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
                self.state.data["registered_thumbprint"] = pending_cert["certificate_thumbprint"]
                self.state.save()
                self.logger.info(f"Certificado registrado no Azure: {response['azure_certificate_key_id']}")
            
            # Check if backend requested certificate re-upload (for new linked tenants)
            request_cert = response.get("request_certificate", False)
            if request_cert and not pending_cert:
                self.logger.info("Backend solicitou reenvio de certificado para novos tenants")
                # Clear the flag so next heartbeat will include the certificate
                if "azure_certificate_key_id" in self.state.data:
                    del self.state.data["azure_certificate_key_id"]
                    self.state.save()
                    self.logger.info("Flag azure_certificate_key_id removida, certificado será reenviado")
            
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
