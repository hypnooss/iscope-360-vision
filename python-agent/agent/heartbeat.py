from agent.version import get_version


class AgentStopped(Exception):
    pass


class AgentHeartbeat:
    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger

    def send(self, status="running", version=None):
        if version is None:
            version = get_version()
        self.logger.info(f"Enviando heartbeat (v{version})")

        try:
            response = self.api.post(
                "/agent-heartbeat",
                json={
                    "status": status,
                    "agent_version": version
                }
            )
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
