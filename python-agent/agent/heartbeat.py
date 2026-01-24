class AgentStopped(Exception):
    pass


class AgentHeartbeat:
    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger

    def send(self, status="running", version="1.0.0"):
        self.logger.info("Enviando heartbeat")

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
                raise

            if "BLOCKED" in msg or "REVOKED" in msg:
                self.logger.critical("Agent bloqueado ou revogado pelo backend")
                raise AgentStopped(msg)

            if "INVALID_TOKEN" in msg or "INVALID_SIGNATURE" in msg:
                self.logger.critical("Token inválido. Limpando estado local.")
                self.state.data.clear()
                self.state.save()
                raise AgentStopped(msg)

            raise
