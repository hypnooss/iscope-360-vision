"""
Supervisor Heartbeat — Lightweight heartbeat loop.

Reuses the agent's APIClient and AgentHeartbeat classes but runs
independently in the Supervisor process.

Sends supervisor_version alongside agent_version so the backend
can track both and signal cross-updates.
"""

from agent.heartbeat import AgentStopped
from supervisor.version import get_version as get_supervisor_version


class SupervisorHeartbeatLoop:
    """Runs the heartbeat loop and returns control signals."""

    def __init__(self, heartbeat, auth, logger):
        self.heartbeat = heartbeat
        self.auth = auth
        self.logger = logger

    def tick(self) -> dict:
        """
        Send one heartbeat and return the response.

        Handles token refresh automatically.
        Returns the heartbeat response dict, or an error dict.
        """
        try:
            # Refresh token proactively
            if not self.auth.is_access_token_valid():
                self.logger.info("[Supervisor] Token próximo de expirar, renovando...")
                self.auth.refresh_tokens()

            result = self.heartbeat.send(
                status="running",
                supervisor_version=get_supervisor_version(),
            )

            self.logger.info(
                f"[Supervisor] Heartbeat OK | "
                f"update={result.get('update_available')} | "
                f"sup_update={result.get('supervisor_update_available', False)} | "
                f"next={result.get('next_heartbeat_in', '?')}s"
            )

            return result

        except AgentStopped as e:
            self.logger.critical(f"[Supervisor] Agent parado pelo backend: {e}")
            return {"error": "AGENT_STOPPED", "detail": str(e)}

        except RuntimeError as e:
            msg = str(e)
            if "TOKEN_EXPIRED" in msg:
                self.logger.info("[Supervisor] Token expirado, renovando...")
                try:
                    self.auth.refresh_tokens()
                except Exception as re:
                    self.logger.error(f"[Supervisor] Falha ao renovar token: {re}")
            else:
                self.logger.error(f"[Supervisor] Erro no heartbeat: {e}")
            return {"error": "HEARTBEAT_FAILED", "detail": msg}

        except Exception as e:
            self.logger.error(f"[Supervisor] Erro inesperado: {e}")
            return {"error": "UNKNOWN", "detail": str(e)}
