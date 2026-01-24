from agent.config import API_BASE_URL, POLL_INTERVAL, STATE_FILE
from agent.state import AgentState
from agent.api_client import APIClient
from agent.auth import AuthManager
from agent.scheduler import AgentScheduler
from agent.heartbeat import AgentHeartbeat, AgentStopped
from agent.logger import setup_logger

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

    def agent_loop(self):
        self.logger.info("Início do loop do agent")

        self.auth.ensure_authenticated()

        result = self.heartbeat.send(
            status="running",
            version="1.0.0"
        )

        next_interval = result.get("next_heartbeat_in", POLL_INTERVAL)

        self.logger.info(
            f"Heartbeat OK | config_flag={result.get('config_flag')} | "
            f"next={next_interval}s"
        )

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
