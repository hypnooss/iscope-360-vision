"""
iScope 360 Supervisor — Entrypoint.

Lightweight process that:
1. Sends heartbeats to the backend
2. Manages the Worker process lifecycle (start/stop/restart)
3. Handles Worker updates (download, validate, replace, restart)
4. Installs system components when requested
5. Detects supervisor_restart.flag and exits for systemd restart (cross-update)

This process is intentionally small and stable so it rarely needs
a manual update itself.
"""

import json
import re
import sys
import time
from pathlib import Path
from typing import Optional

from supervisor.version import get_version as get_supervisor_version
from supervisor.config import (
    API_BASE_URL,
    STATE_FILE,
    HEARTBEAT_INTERVAL,
    WORKER_INSTALL_DIR,
    WORKER_HEALTH_FILE,
    WORKER_PID_FILE,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
)
from supervisor.heartbeat import SupervisorHeartbeatLoop
from supervisor.updater import SupervisorUpdater
from supervisor.worker_manager import WorkerManager

# Reuse agent infrastructure (API client, state, auth, heartbeat, logger)
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager
from agent.heartbeat import AgentHeartbeat
from supervisor.logger import setup_supervisor_logger
from agent.components import ensure_system_components
from agent.remote_commands import RemoteCommandHandler
from agent.realtime_commands import ShellCommandPoller
from supervisor.realtime_shell import RealtimeShell

# Cross-update paths
SUPERVISOR_RESTART_FLAG = Path("/var/lib/iscope-agent/supervisor_restart.flag")
PENDING_SUPERVISOR_UPDATE = Path("/var/lib/iscope-agent/pending_supervisor_update.json")

# Regex to extract __version__ from agent/version.py on disk
_VERSION_RE = re.compile(r'__version__\s*=\s*["\']([^"\']+)["\']')


def _read_worker_version_from_disk() -> Optional[str]:
    """
    Read the Worker's __version__ directly from disk, bypassing
    Python's import cache. This is critical because the Supervisor
    is a long-lived process that updates Worker files in-place
    without restarting itself.

    Returns the version string, or None on failure.
    """
    version_file = WORKER_INSTALL_DIR / "agent" / "version.py"
    try:
        content = version_file.read_text(encoding="utf-8")
        m = _VERSION_RE.search(content)
        if m:
            return m.group(1)
    except Exception:
        pass
    return None


def main():
    logger = setup_supervisor_logger()
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

    # --- Realtime Shell: on-demand WebSocket (started via heartbeat flag) ---
    realtime_shell = None
    realtime_active = False

    # --- Check for component flag (from previous check_components request) ---
    _check_component_flag(logger)

    # --- Main loop ---
    logger.info(f"Supervisor entrando no loop principal (intervalo base: {HEARTBEAT_INTERVAL}s)")

    consecutive_errors = 0
    MAX_CONSECUTIVE_ERRORS = 10

    while True:
        interval = HEARTBEAT_INTERVAL

        # --- Cross-update: check if Worker updated us ---
        if SUPERVISOR_RESTART_FLAG.exists():
            try:
                new_version = SUPERVISOR_RESTART_FLAG.read_text().strip()
                logger.info(f"[Supervisor] Restart flag detectada (v{new_version}). Encerrando para systemd reiniciar.")
            except Exception:
                logger.info("[Supervisor] Restart flag detectada. Encerrando para systemd reiniciar.")
            SUPERVISOR_RESTART_FLAG.unlink(missing_ok=True)
            worker.stop()
            sys.exit(0)

        # --- Resolve Worker version from disk (not import cache) ---
        agent_version = _read_worker_version_from_disk()
        if not agent_version:
            # Fallback: use the (possibly stale) in-memory import
            from agent.version import get_version
            agent_version = get_version()
            logger.warning(f"[Supervisor] Não foi possível ler versão do disco, usando fallback: {agent_version}")

        result = hb_loop.tick(agent_version=agent_version)

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

            # Handle AGENT update (Supervisor updates the Worker)
            if result.get("update_available") and result.get("update_info"):
                _handle_update(result, updater, worker, agent_version, logger)

            # Handle SUPERVISOR update signal (write pending file for Worker to apply)
            if result.get("supervisor_update_available") and result.get("supervisor_update_info"):
                _handle_supervisor_update_signal(result, logger)

            # Handle component check
            if result.get("check_components"):
                _handle_check_components(logger, worker)

            # Handle remote commands
            if result.get("has_pending_commands"):
                try:
                    remote_cmds.process_pending_commands()
                except Exception as e:
                    logger.error(f"[Supervisor] Erro ao processar comandos remotos: {e}")

            # Handle on-demand Realtime Shell (WebSocket)
            should_realtime = result.get("start_realtime", False)
            if should_realtime and not realtime_active:
                if SUPABASE_URL and SUPABASE_ANON_KEY:
                    logger.info("[Supervisor] Heartbeat solicitou início do Realtime Shell (WebSocket).")
                    realtime_shell = RealtimeShell(
                        supabase_url=SUPABASE_URL,
                        anon_key=SUPABASE_ANON_KEY,
                        agent_id=str(state.get("agent_id", "")),
                        logger=logger,
                    )
                    realtime_shell.start()
                    realtime_active = True
                else:
                    logger.warning("[Supervisor] Realtime Shell solicitado mas SUPABASE_URL/ANON_KEY não configurados.")
            elif not should_realtime and realtime_active:
                logger.info("[Supervisor] Heartbeat solicitou parada do Realtime Shell.")
                if realtime_shell:
                    realtime_shell.stop()
                    realtime_shell = None
                realtime_active = False

            # Check if realtime shell timed out or session was closed
            if realtime_active and realtime_shell and (realtime_shell.timed_out or realtime_shell.session_closed):
                reason = "inatividade (120s)" if realtime_shell.timed_out else "sessão encerrada pelo GUI"
                logger.info(f"[Supervisor] Realtime Shell encerrado: {reason}.")
                realtime_shell.stop()
                realtime_shell = None
                realtime_active = False

        # Monitor worker health (systemd manages restart, but we ensure it's up)
        if not worker.is_running():
            logger.warning("[Supervisor] Worker service inativo! Iniciando via systemctl...")
            worker.start()

        time.sleep(interval)


def _handle_update(result: dict, updater: SupervisorUpdater, worker: WorkerManager,
                   current_version: str, logger):
    """Process an AGENT update signal from the heartbeat (Supervisor updates Worker)."""
    update_info = result["update_info"]
    target_version = update_info.get("version", "?")

    # Guard: skip if Worker on disk is already at the target version
    if current_version == target_version:
        logger.info(
            f"[Supervisor] Update skip | latest={target_version} "
            f"current={current_version} action=skip (already on disk)"
        )
        return

    logger.info(
        f"[Supervisor] Update apply | latest={target_version} "
        f"current={current_version} action=apply"
    )

    success = updater.check_and_update(update_info, worker)
    if success:
        logger.info(f"[Supervisor] Worker atualizado para v{target_version} com sucesso")
    else:
        logger.error(f"[Supervisor] Falha ao atualizar Worker para v{target_version}")


def _handle_supervisor_update_signal(result: dict, logger):
    """Write pending_supervisor_update.json for the Worker to pick up and apply."""
    sup_info = result["supervisor_update_info"]
    version = sup_info.get("version", "?")

    # Don't overwrite if already pending
    if PENDING_SUPERVISOR_UPDATE.exists():
        try:
            existing = json.loads(PENDING_SUPERVISOR_UPDATE.read_text())
            if existing.get("version") == version:
                return  # Already pending same version
        except Exception:
            pass

    logger.info(f"[Supervisor] Supervisor update v{version} disponível — escrevendo pending file para Worker aplicar")
    try:
        PENDING_SUPERVISOR_UPDATE.parent.mkdir(parents=True, exist_ok=True)
        PENDING_SUPERVISOR_UPDATE.write_text(json.dumps(sup_info))
    except Exception as e:
        logger.error(f"[Supervisor] Erro ao escrever pending supervisor update: {e}")


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
