"""
iScope 360 Monitor — Standalone entrypoint.

Runs as an independent systemd service (iscope-monitor.service).
Collects system metrics and sends them to the backend via the shared
API infrastructure (agent.api_client / agent.auth).
"""

import json
import sys
import time
from pathlib import Path

from monitor.collector import MetricsCollector
from monitor.version import get_version

# Reuse agent infrastructure for API communication
from agent.config import API_BASE_URL, STATE_FILE
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager


MONITOR_SNAPSHOT_FILE = Path("/var/lib/iscope-agent/monitor.json")
MONITOR_INTERVAL = 60  # seconds


def _load_interval() -> int:
    """Read MONITOR_INTERVAL from env (set via EnvironmentFile)."""
    import os
    return max(int(os.getenv("MONITOR_INTERVAL", "60")), 10)


def main():
    import logging

    logger = logging.getLogger("iscope-monitor")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    # Console handler
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(handler)

    # File handler
    log_file = Path("/var/log/iscope-agent/monitor.log")
    log_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        fh = logging.FileHandler(str(log_file))
        fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
        logger.addHandler(fh)
    except Exception:
        pass

    logger.info(f"=== iScope Monitor v{get_version()} (standalone) ===")

    if not API_BASE_URL:
        logger.critical("AGENT_API_BASE_URL não configurada. Abortando.")
        sys.exit(1)

    # Shared state & auth (reuses agent's state.json)
    state = AgentState(STATE_FILE)
    state.load()

    api = APIClient(API_BASE_URL, state, logger)
    auth = AuthManager(state, api, logger)
    api.set_auth_manager(auth)

    # Wait for agent to be authenticated (state.json must have tokens)
    _wait_for_auth(state, logger)

    interval = _load_interval()
    collector = MetricsCollector(disk_path="/")

    logger.info(f"Monitor iniciado (intervalo={interval}s)")

    # First collection warms up CPU/net deltas
    collector.collect()
    time.sleep(min(interval, 5))

    consecutive_errors = 0

    while True:
        try:
            # Refresh tokens if needed
            try:
                if not auth.is_access_token_valid():
                    logger.info("[Monitor] Token próximo de expirar, renovando...")
                    auth.refresh_tokens()
            except Exception as e:
                logger.warning(f"[Monitor] Erro ao renovar token: {e}")

            metrics = collector.collect()
            metrics["monitor_version"] = get_version()
            metrics["agent_id"] = str(state.data.get("agent_id", ""))

            # Save local snapshot
            _save_snapshot(metrics)

            # Send to backend
            _send(api, metrics, logger)
            consecutive_errors = 0

        except Exception as e:
            consecutive_errors += 1
            logger.error(f"[Monitor] Erro na coleta/envio: {e}")

            if consecutive_errors >= 5:
                backoff = min(consecutive_errors * 10, 300)
                logger.warning(f"[Monitor] {consecutive_errors} erros consecutivos, backoff {backoff}s")
                time.sleep(backoff)
                continue

        time.sleep(interval)


def _wait_for_auth(state: "AgentState", logger):
    """Wait until the agent has been authenticated (tokens present in state)."""
    max_wait = 300  # 5 minutes
    waited = 0
    while waited < max_wait:
        state.load()
        if state.data.get("access_token"):
            logger.info("[Monitor] Tokens detectados no state.json")
            return
        if waited == 0:
            logger.info("[Monitor] Aguardando autenticação do agent (state.json sem tokens)...")
        time.sleep(10)
        waited += 10

    logger.warning("[Monitor] Timeout esperando tokens. Tentando continuar mesmo assim...")


def _send(api, metrics: dict, logger):
    """POST metrics to the agent-monitor edge function."""
    try:
        resp = api.post("/agent-monitor", json=metrics)
        if isinstance(resp, dict) and not resp.get("success", True):
            logger.warning(f"[Monitor] Backend retornou erro: {resp.get('error', 'unknown')}")
    except Exception as e:
        logger.warning(f"[Monitor] Falha ao enviar métricas: {e}")


def _save_snapshot(metrics: dict):
    """Persist latest metrics locally for debug / health checks."""
    try:
        MONITOR_SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
        MONITOR_SNAPSHOT_FILE.write_text(
            json.dumps(metrics, default=str), encoding="utf-8"
        )
    except Exception:
        pass


if __name__ == "__main__":
    main()
