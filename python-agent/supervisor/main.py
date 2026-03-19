"""
iScope 360 Supervisor — Entrypoint.

Lightweight process that:
1. Sends heartbeats to the backend
2. Manages the Worker process lifecycle (start/stop/restart)
3. Handles Worker updates (download, validate, replace, restart)
4. Handles Monitor updates (download, validate, replace, restart)
5. Installs system components when requested
6. Detects supervisor_restart.flag and exits for systemd restart (cross-update)
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
    MONITOR_INTERVAL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
)
from supervisor.heartbeat import SupervisorHeartbeatLoop
from supervisor.updater import SupervisorUpdater
from supervisor.monitor_updater import MonitorUpdater
from supervisor.worker_manager import WorkerManager

# Reuse agent infrastructure
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager
from agent.heartbeat import AgentHeartbeat
from supervisor.logger import setup_supervisor_logger
from agent.components import ensure_system_components
from agent.remote_commands import RemoteCommandHandler
from supervisor.realtime_shell import RealtimeShell
# monitor is imported lazily in main() to avoid boot failure if missing

# Cross-update paths
SUPERVISOR_RESTART_FLAG = Path("/var/lib/iscope-agent/supervisor_restart.flag")
PENDING_SUPERVISOR_UPDATE = Path("/var/lib/iscope-agent/pending_supervisor_update.json")

# Regex to extract __version__ from version.py on disk
_VERSION_RE = re.compile(r'__version__\s*=\s*["\']([^"\']+)["\']')


def _read_version_from_disk(module_dir: Path, module_name: str) -> Optional[str]:
    """Read a module's __version__ directly from disk, bypassing import cache."""
    version_file = module_dir / module_name / "version.py"
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

    # --- Shared state & auth ---
    state = AgentState(STATE_FILE)
    state.load()

    api = APIClient(API_BASE_URL, state, logger)
    auth = AuthManager(state, api, logger)
    api.set_auth_manager(auth)

    auth.ensure_authenticated()

    # --- Components ---
    heartbeat = AgentHeartbeat(api, state, logger)
    hb_loop = SupervisorHeartbeatLoop(heartbeat, auth, logger)
    updater = SupervisorUpdater(logger, WORKER_INSTALL_DIR)
    monitor_updater = MonitorUpdater(logger, WORKER_INSTALL_DIR)
    worker = WorkerManager(logger, WORKER_INSTALL_DIR, WORKER_HEALTH_FILE, WORKER_PID_FILE)
    remote_cmds = RemoteCommandHandler(api, logger)

    # --- Start worker on boot ---
    worker.start()

    # --- Start monitor thread ---
    monitor_thread = MonitorWorker(
        api=api, state=state, logger=logger,
        interval=MONITOR_INTERVAL, disk_path="/"
    )
    monitor_thread.start()

    # --- Realtime Shell ---
    realtime_shell = None
    realtime_active = False

    # --- Check component flag ---
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
            monitor_thread.stop()
            worker.stop()
            sys.exit(0)

        # --- Resolve versions from disk ---
        agent_version = _read_version_from_disk(WORKER_INSTALL_DIR, "agent")
        if not agent_version:
            from agent.version import get_version
            agent_version = get_version()
            logger.warning(f"[Supervisor] Não foi possível ler versão do agent do disco, usando fallback: {agent_version}")

        monitor_version = _read_version_from_disk(WORKER_INSTALL_DIR, "monitor")
        if not monitor_version:
            try:
                from monitor.version import get_version as get_mon_version
                monitor_version = get_mon_version()
            except Exception:
                monitor_version = None

        result = hb_loop.tick(agent_version=agent_version, monitor_version=monitor_version)

        if "error" in result:
            consecutive_errors += 1
            if result["error"] == "AGENT_STOPPED":
                logger.critical("Backend bloqueou o agent. Parando Worker e encerrando.")
                monitor_thread.stop()
                worker.stop()
                sys.exit(1)

            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                logger.error(f"[Supervisor] {consecutive_errors} erros consecutivos. Reiniciando Worker por precaução.")
                worker.restart()
                consecutive_errors = 0
        else:
            consecutive_errors = 0
            interval = result.get("next_heartbeat_in", HEARTBEAT_INTERVAL)

            # Handle AGENT update
            if result.get("update_available") and result.get("update_info"):
                _handle_update(result, updater, worker, agent_version, logger)

            # Handle SUPERVISOR update signal
            if result.get("supervisor_update_available") and result.get("supervisor_update_info"):
                _handle_supervisor_update_signal(result, logger)

            # Handle MONITOR update
            if result.get("monitor_update_available") and result.get("monitor_update_info"):
                _handle_monitor_update(result, monitor_updater, monitor_thread, monitor_version, logger)

            # Handle component check
            if result.get("check_components"):
                _handle_check_components(logger, worker)

            # Handle remote commands
            if result.get("has_pending_commands"):
                try:
                    remote_cmds.process_pending_commands()
                except Exception as e:
                    logger.error(f"[Supervisor] Erro ao processar comandos remotos: {e}")

            # Handle on-demand Realtime Shell
            should_realtime = result.get("start_realtime", False)
            if should_realtime and not realtime_active:
                if SUPABASE_URL and SUPABASE_ANON_KEY:
                    logger.info("[Supervisor] Heartbeat solicitou início do Realtime Shell (WebSocket).")
                    try:
                        realtime_shell = RealtimeShell(
                            supabase_url=SUPABASE_URL,
                            anon_key=SUPABASE_ANON_KEY,
                            agent_id=str(state.data.get("agent_id", "")),
                            logger=logger,
                        )
                        realtime_shell.start()
                        realtime_active = True
                        logger.info("[Supervisor] RealtimeShell thread iniciada com sucesso.")
                    except Exception as e:
                        logger.error(f"[Supervisor] Falha ao iniciar RealtimeShell: {e}", exc_info=True)
                        realtime_shell = None
                        realtime_active = False
                else:
                    logger.warning("[Supervisor] Realtime Shell solicitado mas SUPABASE_URL/ANON_KEY não configurados.")
            elif not should_realtime and realtime_active:
                logger.info("[Supervisor] Heartbeat solicitou parada do Realtime Shell.")
                if realtime_shell:
                    realtime_shell.stop()
                    realtime_shell = None
                realtime_active = False

            # Check if realtime shell timed out
            if realtime_active and realtime_shell and (realtime_shell.timed_out or realtime_shell.session_closed):
                reason = "inatividade (120s)" if realtime_shell.timed_out else "sessão encerrada pelo GUI"
                logger.info(f"[Supervisor] Realtime Shell encerrado: {reason}.")
                realtime_shell.stop()
                realtime_shell = None
                realtime_active = False

        # Monitor worker health
        if not worker.is_running():
            logger.warning("[Supervisor] Worker service inativo! Iniciando via systemctl...")
            worker.start()

        time.sleep(interval)


def _handle_update(result: dict, updater: SupervisorUpdater, worker: WorkerManager,
                   current_version: str, logger):
    """Process an AGENT update signal."""
    update_info = result["update_info"]
    target_version = update_info.get("version", "?")

    if current_version == target_version:
        logger.info(f"[Supervisor] Update skip | latest={target_version} current={current_version} action=skip")
        return

    logger.info(f"[Supervisor] Update apply | latest={target_version} current={current_version} action=apply")
    success = updater.check_and_update(update_info, worker)
    if success:
        logger.info(f"[Supervisor] Worker atualizado para v{target_version} com sucesso")
    else:
        logger.error(f"[Supervisor] Falha ao atualizar Worker para v{target_version}")


def _handle_supervisor_update_signal(result: dict, logger):
    """Write pending_supervisor_update.json for the Worker to pick up."""
    sup_info = result["supervisor_update_info"]
    version = sup_info.get("version", "?")

    if PENDING_SUPERVISOR_UPDATE.exists():
        try:
            existing = json.loads(PENDING_SUPERVISOR_UPDATE.read_text())
            if existing.get("version") == version:
                return
        except Exception:
            pass

    logger.info(f"[Supervisor] Supervisor update v{version} disponível — escrevendo pending file")
    try:
        PENDING_SUPERVISOR_UPDATE.parent.mkdir(parents=True, exist_ok=True)
        PENDING_SUPERVISOR_UPDATE.write_text(json.dumps(sup_info))
    except Exception as e:
        logger.error(f"[Supervisor] Erro ao escrever pending supervisor update: {e}")


def _handle_monitor_update(result: dict, monitor_updater: MonitorUpdater,
                           monitor_thread: MonitorWorker, current_version: Optional[str], logger):
    """Process a MONITOR update signal."""
    update_info = result["monitor_update_info"]
    target_version = update_info.get("version", "?")

    if current_version == target_version:
        logger.info(f"[Supervisor] Monitor update skip | latest={target_version} current={current_version}")
        return

    logger.info(f"[Supervisor] Monitor update apply | latest={target_version} current={current_version or '?'}")
    success = monitor_updater.check_and_update(update_info, monitor_thread)
    if success:
        logger.info(f"[Supervisor] Monitor atualizado para v{target_version} com sucesso")
    else:
        logger.error(f"[Supervisor] Falha ao atualizar Monitor para v{target_version}")


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
