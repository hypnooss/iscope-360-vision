import requests


class APIClient:
    def __init__(self, base_url, state, logger):
        self.base_url = base_url.rstrip("/")
        self.state = state
        self.logger = logger

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
        response = requests.get(
            f"{self.base_url}{path}",
            headers=self._headers(),
            timeout=10
        )

        if not response.ok:
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

        response = requests.post(
            f"{self.base_url}{path}",
            json=json,
            headers=headers,
            timeout=10
        )

        if not response.ok:
            error_msg = self._extract_error(response)
            self.logger.error(f"POST {path} -> {error_msg}")
            raise RuntimeError(error_msg)

        return response.json()
