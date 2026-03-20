"""
iScope 360 Monitor — Standalone entrypoint (template-driven).

Runs as an independent systemd service (iscope-monitor.service).
Fetches a blueprint from the backend and executes collection steps
using internal executors. Falls back to legacy collector if blueprint
is unavailable. Supports per-step interval_seconds for granular
collection frequency.
"""

import json
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional

from monitor.collector import MetricsCollector
from monitor.version import get_version
from monitor.executors import get_executor

# Reuse agent infrastructure for API communication
from agent.config import API_BASE_URL, STATE_FILE
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager


MONITOR_SNAPSHOT_FILE = Path("/var/lib/iscope-agent/monitor.json")
BLUEPRINT_CACHE_FILE = Path("/var/lib/iscope-agent/monitor_blueprint.json")
BLUEPRINT_REFRESH_INTERVAL = 1800  # 30 minutes
DEFAULT_STEP_INTERVAL = 60  # seconds
MIN_BASE_INTERVAL = 10  # seconds


def _load_interval() -> int:
    """Read MONITOR_INTERVAL from env (set via EnvironmentFile)."""
    import os
    return max(int(os.getenv("MONITOR_INTERVAL", "60")), MIN_BASE_INTERVAL)


def _compute_base_interval(blueprint: Dict[str, Any]) -> int:
    """Derive the loop sleep from the smallest step interval_seconds."""
    intervals = [
        step.get("interval_seconds", DEFAULT_STEP_INTERVAL)
        for step in blueprint.get("steps", [])
    ]
    return max(min(intervals) if intervals else DEFAULT_STEP_INTERVAL, MIN_BASE_INTERVAL)


def main():
    import logging
    from logging.handlers import RotatingFileHandler

    logger = logging.getLogger("iscope-monitor")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    log_file = Path("/var/log/iscope-agent/monitor.log")
    log_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        fh = RotatingFileHandler(str(log_file), maxBytes=1 * 1024 * 1024, backupCount=1)
        fh.setFormatter(formatter)
        logger.addHandler(fh)
    except Exception:
        pass

    logger.info(f"=== iScope Monitor v{get_version()} (template-driven) ===")

    if not API_BASE_URL:
        logger.critical("AGENT_API_BASE_URL não configurada. Abortando.")
        sys.exit(1)

    state = AgentState(STATE_FILE)
    state.load()

    api = APIClient(API_BASE_URL, state, logger)
    auth = AuthManager(state, api, logger)
    api.set_auth_manager(auth)

    _wait_for_auth(state, logger)

    legacy_collector = MetricsCollector(disk_path="/")
    executor_instances: Dict[str, Any] = {}

    # Per-step timing
    last_collected_at: Dict[str, float] = {}
    # Cumulative snapshot (merge incremental)
    cumulative_snapshot: Dict[str, Any] = {}

    blueprint = _load_blueprint(api, logger)
    blueprint_loaded_at = time.monotonic()

    if blueprint:
        logger.info(
            f"Blueprint carregado: {blueprint.get('name')} v{blueprint.get('version')} "
            f"({len(blueprint.get('steps', []))} steps)"
        )
        executor_instances = _init_executors(blueprint, logger)
        base_interval = _compute_base_interval(blueprint)
        logger.info(f"Base interval: {base_interval}s (menor interval_seconds dos steps)")

        # Log per-step intervals
        for step in blueprint.get("steps", []):
            iv = step.get("interval_seconds", DEFAULT_STEP_INTERVAL)
            logger.info(f"  Step '{step.get('id')}': cada {iv}s")
    else:
        logger.warning("Blueprint indisponível, usando coletor legado (fallback)")
        base_interval = _load_interval()

    # Warm-up collection (CPU/net deltas)
    if blueprint and executor_instances:
        _collect_from_blueprint(blueprint, executor_instances, last_collected_at, logger, force_all=True)
    else:
        legacy_collector.collect()
    time.sleep(min(base_interval, 5))

    consecutive_errors = 0

    while True:
        try:
            # Refresh tokens
            try:
                if not auth.is_access_token_valid():
                    logger.info("[Monitor] Token próximo de expirar, renovando...")
                    auth.refresh_tokens()
            except Exception as e:
                logger.warning(f"[Monitor] Erro ao renovar token: {e}")

            # Periodically refresh blueprint
            if time.monotonic() - blueprint_loaded_at > BLUEPRINT_REFRESH_INTERVAL:
                new_bp = _load_blueprint(api, logger)
                if new_bp:
                    if new_bp.get("version") != (blueprint or {}).get("version"):
                        logger.info(
                            f"Blueprint atualizado: v{new_bp.get('version')} "
                            f"(anterior: v{(blueprint or {}).get('version', 'N/A')})"
                        )
                        executor_instances = _init_executors(new_bp, logger)
                        last_collected_at.clear()
                    blueprint = new_bp
                    base_interval = _compute_base_interval(blueprint)
                blueprint_loaded_at = time.monotonic()

            # Collect metrics
            if blueprint and executor_instances:
                metrics = _collect_from_blueprint(
                    blueprint, executor_instances, last_collected_at, logger
                )
            else:
                metrics = legacy_collector.collect()

            if metrics:
                metrics["monitor_version"] = get_version()
                metrics["agent_id"] = str(state.data.get("agent_id", ""))

                # Merge into cumulative snapshot
                cumulative_snapshot.update(metrics)
                _save_snapshot(cumulative_snapshot)

                # Send partial payload
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

        time.sleep(base_interval)


def _load_blueprint(api, logger) -> Optional[Dict[str, Any]]:
    """Fetch blueprint from backend, with local cache fallback."""
    try:
        resp = api.get("/agent-monitor-blueprint?device_type=linux_server")
        if isinstance(resp, dict) and resp.get("success") and resp.get("blueprint"):
            bp = resp["blueprint"]
            try:
                BLUEPRINT_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
                BLUEPRINT_CACHE_FILE.write_text(json.dumps(bp, default=str), encoding="utf-8")
            except Exception:
                pass
            return bp
    except Exception as e:
        logger.warning(f"[Monitor] Falha ao buscar blueprint do backend: {e}")

    try:
        if BLUEPRINT_CACHE_FILE.exists():
            bp = json.loads(BLUEPRINT_CACHE_FILE.read_text(encoding="utf-8"))
            logger.info("[Monitor] Blueprint carregado do cache local")
            return bp
    except Exception:
        pass

    return None


def _init_executors(blueprint: Dict[str, Any], logger) -> Dict[str, Any]:
    """Pre-instantiate executor objects for each unique step type."""
    instances: Dict[str, Any] = {}
    for step in blueprint.get("steps", []):
        step_type = step.get("type")
        if step_type and step_type not in instances:
            executor_cls = get_executor(step_type)
            if executor_cls:
                instances[step_type] = executor_cls()
                logger.info(f"[Monitor] Executor inicializado: {step_type}")
            else:
                logger.warning(f"[Monitor] Executor desconhecido: {step_type}")
    return instances


def _collect_from_blueprint(
    blueprint: Dict[str, Any],
    executor_instances: Dict[str, Any],
    last_collected_at: Dict[str, float],
    logger,
    force_all: bool = False,
) -> Dict[str, Any]:
    """Iterate blueprint steps, respecting per-step interval_seconds."""
    metrics: Dict[str, Any] = {}
    now = time.monotonic()

    for step in blueprint.get("steps", []):
        step_id = step.get("id", "?")
        step_type = step.get("type")
        params = step.get("params", {})
        interval = step.get("interval_seconds", DEFAULT_STEP_INTERVAL)

        executor = executor_instances.get(step_type)
        if not executor:
            continue

        elapsed = now - last_collected_at.get(step_id, 0)
        if not force_all and elapsed < interval:
            continue

        try:
            result = executor.execute(params)
            metrics.update(result)
            last_collected_at[step_id] = now
        except Exception as e:
            logger.warning(f"[Monitor] Erro no step '{step_id}' ({step_type}): {e}")

    return metrics


def _wait_for_auth(state: "AgentState", logger):
    """Wait until the agent has been authenticated (tokens present in state)."""
    max_wait = 300
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
        MONITOR_SNAPSHOT_FILE.write_text(json.dumps(metrics, default=str), encoding="utf-8")
    except Exception:
        pass


if __name__ == "__main__":
    main()
