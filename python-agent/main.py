from agent.config import API_BASE_URL, POLL_INTERVAL, STATE_FILE
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager
from agent.scheduler import AgentScheduler
from agent.heartbeat import AgentHeartbeat, AgentStopped
from agent.heartbeat_worker import HeartbeatWorker
from agent.tasks import TaskExecutor
from agent.logger import setup_logger
from agent.updater import AutoUpdater
from agent.version import get_version

import argparse
import json
import sys
from pathlib import Path


EMPTY_STATE = {
    "agent_id": None,
    "access_token": None,
    "refresh_token": None,
    "last_success": None,
    "offline_since": None
}


def reset_agent_state():
    state_path = Path(STATE_FILE)
    state_path.parent.mkdir(parents=True, exist_ok=True)

    with open(state_path, "w") as f:
        json.dump(EMPTY_STATE, f, indent=2)

    print("Agent resetado para estado inicial.")
    print("Configure um novo AGENT_ACTIVATION_CODE para registrar novamente.")
    sys.exit(0)


def parse_args():
    parser = argparse.ArgumentParser(description="InfraScope Agent")
    parser.add_argument(
        "--reset-default",
        action="store_true",
        help="Reseta o agent para o estado inicial"
    )
    return parser.parse_args()


class AgentApp:
    def __init__(self, logger):
        self.logger = logger

        self.state = AgentState(STATE_FILE)
        self.state.load()

        self.api = APIClient(API_BASE_URL, self.state, logger)
        self.auth = AuthManager(self.state, self.api, logger)
        self.api.set_auth_manager(self.auth)
        self.heartbeat = AgentHeartbeat(self.api, self.state, logger)
        self.task_executor = TaskExecutor(self.api, self.state, logger)
        self.updater = AutoUpdater(logger)

        # HeartbeatWorker runs in a separate daemon thread
        self.hb_worker = HeartbeatWorker(
            api=self.api,
            auth=self.auth,
            heartbeat=self.heartbeat,
            state=self.state,
            updater=self.updater,
            logger=logger,
            default_interval=POLL_INTERVAL
        )

    def start(self):
        """Register, start heartbeat worker, then enter task loop."""
        self.logger.info(f"Agent v{get_version()} iniciando...")

        # Must register before anything else
        self.auth.ensure_authenticated()

        # Start heartbeat worker (daemon thread)
        self.hb_worker.start()
        self.logger.info("HeartbeatWorker thread iniciada")

        # Enter task processing loop
        scheduler = AgentScheduler(POLL_INTERVAL, self.agent_loop, self.logger)
        scheduler.start()

    def agent_loop(self):
        """Main loop: only processes tasks. Heartbeat is handled by the worker thread."""
        self.logger.info(f"Início do loop de tarefas v{get_version()}")

        # Check if heartbeat worker signaled a stop (BLOCKED/REVOKED)
        if self.hb_worker.should_stop:
            self.logger.critical("HeartbeatWorker sinalizou parada. Encerrando agent.")
            raise AgentStopped("Agent parado pelo HeartbeatWorker")

        # Ensure token is valid before fetching tasks
        if not self.auth.is_access_token_valid():
            self.auth.refresh_tokens()

        # Fetch and process pending tasks
        try:
            self.hb_worker.signal_has_pending_tasks()
            processed = self.task_executor.process_all()
            self.hb_worker.clear_pending_tasks()

            if processed > 0:
                self.logger.info(f"{processed} tarefas processadas")
        except RuntimeError as e:
            self.hb_worker.clear_pending_tasks()
            msg = str(e)
            if "TOKEN_EXPIRED" in msg:
                self.logger.warning("Token expirou durante execução de tarefa")
                self.auth.refresh_tokens()
            else:
                self.logger.error(f"Erro ao processar tarefas: {e}")

        return POLL_INTERVAL


def main():
    args = parse_args()

    if args.reset_default:
        reset_agent_state()

    logger = setup_logger()
    logger.info("Agent iniciado")

    app = AgentApp(logger)
    app.start()


if __name__ == "__main__":
    main()
