"""
iScope 360 Supervisor — Entrypoint.

Lightweight process that:
1. Sends heartbeats to the backend
2. Manages the Worker process lifecycle (start/stop/restart)
3. Handles Worker updates (download, validate, replace, restart)
4. Installs system components when requested

This process is intentionally small and stable so it rarely needs
a manual update itself.
"""

import sys
import time

from supervisor.version import get_version as get_supervisor_version
from supervisor.config import (
    API_BASE_URL,
    STATE_FILE,
    HEARTBEAT_INTERVAL,
    WORKER_INSTALL_DIR,
    WORKER_HEALTH_FILE,
    WORKER_PID_FILE,
)
from supervisor.heartbeat import SupervisorHeartbeatLoop
from supervisor.updater import SupervisorUpdater
from supervisor.worker_manager import WorkerManager

# Reuse agent infrastructure (API client, state, auth, heartbeat, logger)
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager
from agent.heartbeat import AgentHeartbeat
from agent.logger import setup_logger
from agent.components import ensure_system_components
from agent.remote_commands import RemoteCommandHandler


def main():
    logger = setup_logger()
    logger.info(f"=== iScope Supervisor v{get_supervisor_version()} ===")

    if not API_BASE_URL:
        logger.critical("AGENT_API_BASE_URL não configurada. Abortando.")
        sys.exit(1)

    # --- Shared state & auth (same files as the worker) ---
    state = AgentState(STATE_FILE)
    state.load()

    api = APIClient(API_BASE_URL, state, logger)
    auth = AuthManager(state, api, logger)
    api.set_auth_manager(auth)

    # Ensure registered
    auth.ensure_authenticated()

    # --- Components ---
    heartbeat = AgentHeartbeat(api, state, logger)
    hb_loop = SupervisorHeartbeatLoop(heartbeat, auth, logger)
    updater = SupervisorUpdater(logger, WORKER_INSTALL_DIR)
    worker = WorkerManager(logger, WORKER_INSTALL_DIR, WORKER_HEALTH_FILE, WORKER_PID_FILE)
    remote_cmds = RemoteCommandHandler(api, logger)

    # --- Start worker on boot ---
    worker.start()

    # --- Check for component flag (from previous check_components request) ---
    _check_component_flag(logger)

    # --- Main loop ---
    logger.info(f"Supervisor entrando no loop principal (intervalo base: {HEARTBEAT_INTERVAL}s)")

    consecutive_errors = 0
    MAX_CONSECUTIVE_ERRORS = 10

    while True:
        interval = HEARTBEAT_INTERVAL

        result = hb_loop.tick()

        if "error" in result:
            consecutive_errors += 1
            if result["error"] == "AGENT_STOPPED":
                logger.critical("Backend bloqueou o agent. Parando Worker e encerrando.")
                worker.stop()
                sys.exit(1)

            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                logger.error(f"[Supervisor] {consecutive_errors} erros consecutivos. Reiniciando Worker por precaução.")
                worker.restart()
                consecutive_errors = 0
        else:
            consecutive_errors = 0
            interval = result.get("next_heartbeat_in", HEARTBEAT_INTERVAL)

            # Handle update
            if result.get("update_available") and result.get("update_info"):
                _handle_update(result, updater, worker, logger)

            # Handle component check
            if result.get("check_components"):
                _handle_check_components(logger, worker)

            # Handle remote commands
            if result.get("has_pending_commands"):
                try:
                    remote_cmds.process_pending_commands()
                except Exception as e:
                    logger.error(f"[Supervisor] Erro ao processar comandos remotos: {e}")

        # Monitor worker health
        if not worker.is_running():
            logger.warning("[Supervisor] Worker caiu! Reiniciando...")
            worker.start()

        # Drain worker stdout to our log
        output = worker.collect_output()
        if output:
            for line in output.split("\n"):
                logger.info(f"[Worker] {line}")

        time.sleep(interval)


def _handle_update(result: dict, updater: SupervisorUpdater, worker: WorkerManager, logger):
    """Process an update signal from the heartbeat."""
    update_info = result["update_info"]
    version = update_info.get("version", "?")

    logger.info(f"[Supervisor] Update disponível: v{version}")

    success = updater.check_and_update(update_info, worker)
    if success:
        logger.info(f"[Supervisor] Worker atualizado para v{version} com sucesso")
    else:
        logger.error(f"[Supervisor] Falha ao atualizar Worker para v{version}")


def _handle_check_components(logger, worker: WorkerManager):
    """Install system components, then restart worker."""
    logger.info("[Supervisor] Backend solicitou verificação de componentes")
    try:
        ensure_system_components(logger)
        worker.restart()
    except Exception as e:
        logger.warning(f"[Supervisor] Erro ao verificar componentes: {e}")


def _check_component_flag(logger):
    """Check if a previous run left a component-check flag."""
    from pathlib import Path
    flag = Path("/var/lib/iscope-agent/check_components.flag")
    if flag.exists():
        logger.info("[Supervisor] Flag de componentes encontrada, executando verificação...")
        try:
            ensure_system_components(logger)
        except Exception as e:
            logger.warning(f"[Supervisor] Erro na verificação de componentes: {e}")
        finally:
            flag.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
