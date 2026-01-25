import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("AGENT_API_BASE_URL")
POLL_INTERVAL = int(os.getenv("AGENT_POLL_INTERVAL", "120"))  # Increased from 60s to reduce DB load
STATE_FILE = os.getenv("AGENT_STATE_FILE", "storage/state.json")
