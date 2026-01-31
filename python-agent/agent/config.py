import os
from pathlib import Path

from dotenv import load_dotenv


def _load_env():
    # Production default (installed via curl|bash)
    default_env_path = Path("/etc/iscope/agent.env")
    if default_env_path.exists():
        load_dotenv(str(default_env_path))

    # Dev/local fallback (.env in current working dir)
    load_dotenv()


_load_env()

API_BASE_URL = os.getenv("AGENT_API_BASE_URL")
POLL_INTERVAL = int(os.getenv("AGENT_POLL_INTERVAL", "120"))  # Increased from 60s to reduce DB load
STATE_FILE = os.getenv("AGENT_STATE_FILE", "/var/lib/iscope/state.json")
