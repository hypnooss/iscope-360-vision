import time
import requests


class APIClient:
    TRANSIENT_STATUS_CODES = {429, 502, 503, 504}
    MAX_RETRIES = 3

    def __init__(self, base_url, state, logger):
        self.base_url = base_url.rstrip("/")
        self.state = state
        self.logger = logger
        self._auth_manager = None  # Set after construction to avoid circular dependency

    def set_auth_manager(self, auth_manager):
        """Set auth manager for automatic token refresh on TOKEN_EXPIRED."""
        self._auth_manager = auth_manager

    def _headers(self):
        headers = {"Content-Type": "application/json"}
        token = self.state.data.get("access_token")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    def _extract_error(self, response):
        """
        Sempre retorna uma mensagem limpa para exibição humana.
        """
        try:
            data = response.json()
            if isinstance(data, dict):
                if "code" in data:
                    return data["code"]
                if "error" in data:
                    return data["error"]
        except Exception:
            pass

        return response.text or "Erro desconhecido"

    def get(self, path):
        self.logger.info(f"GET {path}")

        for attempt in range(self.MAX_RETRIES + 1):
            response = requests.get(
                f"{self.base_url}{path}",
                headers=self._headers(),
                timeout=10
            )

            if response.status_code in self.TRANSIENT_STATUS_CODES and attempt < self.MAX_RETRIES:
                wait = 2 ** (attempt + 1)
                self.logger.warning(f"GET {path} -> {response.status_code}, retry {attempt+1}/{self.MAX_RETRIES} in {wait}s")
                time.sleep(wait)
                continue
            break

        if not response.ok:
            error_msg = self._extract_error(response)
            if error_msg == "TOKEN_EXPIRED" and self._auth_manager:
                self.logger.info(f"Token expirado em GET {path}, renovando e retentando...")
                self._auth_manager.refresh_tokens()
                response = requests.get(
                    f"{self.base_url}{path}",
                    headers=self._headers(),
                    timeout=10
                )
                if response.ok:
                    return response.json()
                error_msg = self._extract_error(response)
            self.logger.error(f"GET {path} -> {error_msg}")
            raise RuntimeError(error_msg)

        return response.json()

    def post(self, path, json=None, use_refresh_token=False):
        headers = {"Content-Type": "application/json"}

        if use_refresh_token:
            headers["Authorization"] = f"Bearer {self.state.data.get('refresh_token')}"
        else:
            headers.update(self._headers())

        self.logger.info(f"POST {path}")

        for attempt in range(self.MAX_RETRIES + 1):
            response = requests.post(
                f"{self.base_url}{path}",
                json=json,
                headers=headers,
                timeout=60
            )

            if response.status_code in self.TRANSIENT_STATUS_CODES and attempt < self.MAX_RETRIES:
                wait = 2 ** (attempt + 1)
                self.logger.warning(f"POST {path} -> {response.status_code}, retry {attempt+1}/{self.MAX_RETRIES} in {wait}s")
                time.sleep(wait)
                continue
            break

        if not response.ok:
            error_msg = self._extract_error(response)
            if error_msg == "TOKEN_EXPIRED" and self._auth_manager and not use_refresh_token:
                self.logger.info(f"Token expirado em POST {path}, renovando e retentando...")
                self._auth_manager.refresh_tokens()
                response = requests.post(
                    f"{self.base_url}{path}",
                    json=json,
                    headers=self._headers(),
                    timeout=60
                )
                if response.ok:
                    return response.json()
                error_msg = self._extract_error(response)
            self.logger.error(f"POST {path} -> {error_msg}")
            raise RuntimeError(error_msg)

        return response.json()
