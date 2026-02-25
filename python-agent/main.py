"""
iScope 360 Agent (Worker) — Entrypoint.

This process focuses exclusively on:
- Authentication
- Fetching and executing tasks
- Writing a health file for the Supervisor to monitor
- Cross-update: applying pending Supervisor updates

Heartbeats and updates are handled by the Supervisor process.
"""

from agent.config import API_BASE_URL, POLL_INTERVAL, STATE_FILE
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager
from agent.scheduler import AgentScheduler
from agent.tasks import TaskExecutor
from agent.logger import setup_logger
from agent.version import get_version
from agent.supervisor_updater import SupervisorUpdater

import argparse
import json
import sys
import time
from pathlib import Path


EMPTY_STATE = {
    "agent_id": None,
    "access_token": None,
    "refresh_token": None,
    "last_success": None,
    "offline_since": None
}

HEALTH_FILE = Path("/var/lib/iscope-agent/worker.health")


def reset_agent_state():
    state_path = Path(STATE_FILE)
    state_path.parent.mkdir(parents=True, exist_ok=True)

    with open(state_path, "w") as f:
        json.dump(EMPTY_STATE, f, indent=2)

    print("Agent resetado para estado inicial.")
    print("Configure um novo AGENT_ACTIVATION_CODE para registrar novamente.")
    sys.exit(0)


def parse_args():
    parser = argparse.ArgumentParser(description="InfraScope Agent (Worker)")
    parser.add_argument(
        "--reset-default",
        action="store_true",
        help="Reseta o agent para o estado inicial"
    )
    return parser.parse_args()


def write_health():
    """Write a timestamp to the health file so the Supervisor knows we're alive."""
    try:
        HEALTH_FILE.parent.mkdir(parents=True, exist_ok=True)
        HEALTH_FILE.write_text(str(time.time()))
    except Exception:
        pass


class AgentApp:
    def __init__(self, logger):
        self.logger = logger

        self.state = AgentState(STATE_FILE)
        self.state.load()

        self.api = APIClient(API_BASE_URL, self.state, logger)
        self.auth = AuthManager(self.state, self.api, logger)
        self.api.set_auth_manager(self.auth)
        self.task_executor = TaskExecutor(self.api, self.state, logger)
        self.supervisor_updater = SupervisorUpdater(logger)

    def start(self):
        """Register then enter task loop."""
        self.logger.info(f"Worker v{get_version()} iniciando...")

        # Must register before anything else
        self.auth.ensure_authenticated()

        # Enter task processing loop
        scheduler = AgentScheduler(POLL_INTERVAL, self.agent_loop, self.logger)
        scheduler.start()

    def agent_loop(self):
        """Main loop: processes tasks + checks for pending supervisor updates."""
        self.logger.info(f"Início do loop de tarefas v{get_version()}")

        # Write health file each tick
        write_health()

        # Ensure token is valid before fetching tasks
        if not self.auth.is_access_token_valid():
            self.auth.refresh_tokens()

        # Fetch and process pending tasks
        try:
            processed = self.task_executor.process_all()
            if processed > 0:
                self.logger.info(f"{processed} tarefas processadas")
        except RuntimeError as e:
            msg = str(e)
            if "TOKEN_EXPIRED" in msg:
                self.logger.warning("Token expirou durante execução de tarefa")
                self.auth.refresh_tokens()
            else:
                self.logger.error(f"Erro ao processar tarefas: {e}")

        # Cross-update: check if Supervisor left a pending update for us to apply
        try:
            self.supervisor_updater.check_and_apply()
        except Exception as e:
            self.logger.error(f"Erro ao verificar update do supervisor: {e}")

        return POLL_INTERVAL


def main():
    args = parse_args()

    if args.reset_default:
        reset_agent_state()

    logger = setup_logger()
    logger.info("Worker iniciado")

    app = AgentApp(logger)
    app.start()


if __name__ == "__main__":
    main()
