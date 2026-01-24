import os
import jwt
import time
import sys


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
            return payload.get("exp", 0) > time.time()
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

        try:
            response = self.api.post(
                "/register-agent",
                json={"activation_code": activation_code}
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
