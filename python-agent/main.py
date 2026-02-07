from agent.config import API_BASE_URL, POLL_INTERVAL, STATE_FILE
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager
from agent.scheduler import AgentScheduler
from agent.heartbeat import AgentHeartbeat, AgentStopped
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
        self.heartbeat = AgentHeartbeat(self.api, self.state, logger)
        self.task_executor = TaskExecutor(self.api, self.state, logger)
        self.updater = AutoUpdater(logger)

    def agent_loop(self):
        self.logger.info(f"Início do loop do agent v{get_version()}")

        self.auth.ensure_authenticated()

        try:
            result = self.heartbeat.send(status="running")
        except RuntimeError as e:
            msg = str(e)
            if "TOKEN_EXPIRED" in msg:
                self.logger.info("Token expirado durante heartbeat, renovando...")
                self.auth.refresh_tokens()
                # Retry heartbeat after refresh
                result = self.heartbeat.send(status="running")
            else:
                raise

        next_interval = result.get("next_heartbeat_in", POLL_INTERVAL)

        self.logger.info(
            f"Heartbeat OK | config_flag={result.get('config_flag')} | "
            f"has_pending_tasks={result.get('has_pending_tasks')} | "
            f"update={result.get('update_available')} | "
            f"next={next_interval}s"
        )

        # Check if component verification was requested
        if result.get('check_components'):
            self.logger.info("Backend solicitou verificação de componentes")
            try:
                # Create flag file for the pre-start script (runs as root)
                flag_file = Path("/var/lib/iscope-agent/check_components.flag")
                flag_file.touch()
                self.logger.info("Flag de verificação criada. Solicitando restart...")
                
                # Request service restart - the systemd ExecStartPre will run check-deps.sh as root
                import subprocess
                subprocess.run(
                    ['systemctl', 'restart', 'iscope-agent'],
                    capture_output=True,
                    timeout=30
                )
                # Note: this process will be terminated by the restart
            except Exception as e:
                self.logger.warning(f"Erro ao solicitar verificação de componentes: {e}")

        # Check for available updates
        if result.get('update_available') and result.get('update_info'):
            self.logger.info("Atualização disponível detectada")
            update_info = result['update_info']

            # Force update or no pending tasks: proceed with update
            if update_info.get('force') or not result.get('has_pending_tasks'):
                self.logger.info(f"Iniciando update para v{update_info.get('version')}")
                if self.updater.check_and_update(update_info):
                    # Update succeeded, process will restart
                    return next_interval
            else:
                self.logger.info("Adiando update - há tarefas pendentes")

        # Processar tarefas pendentes se houver
        if result.get('has_pending_tasks'):
            self.logger.info("Tarefas pendentes detectadas. Processando...")

            # Garantir token válido ANTES de processar tarefas
            # Tarefas podem levar vários minutos, então verificamos novamente
            if not self.auth.is_access_token_valid():
                self.logger.info("Token próximo de expirar, renovando antes de processar tarefas...")
                self.auth.refresh_tokens()

            try:
                processed = self.task_executor.process_all()
                self.logger.info(f"{processed} tarefas processadas")
            except RuntimeError as e:
                msg = str(e)
                if "TOKEN_EXPIRED" in msg:
                    # Token expirou durante execução - renovar e reportar erro
                    self.logger.warning("Token expirou durante execução de tarefa")
                    self.auth.refresh_tokens()
                else:
                    self.logger.error(f"Erro ao processar tarefas: {e}")

        return next_interval


def main():
    args = parse_args()

    if args.reset_default:
        reset_agent_state()

    logger = setup_logger()
    logger.info("Agent iniciado")

    app = AgentApp(logger)
    scheduler = AgentScheduler(POLL_INTERVAL, app.agent_loop, logger)
    scheduler.start()


if __name__ == "__main__":
    main()

