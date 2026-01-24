import os
from dotenv import load_dotenv

load_dotenv()

API_BASE_URL = os.getenv("AGENT_API_BASE_URL")
POLL_INTERVAL = int(os.getenv("AGENT_POLL_INTERVAL", "60"))
STATE_FILE = os.getenv("AGENT_STATE_FILE", "storage/state.json")
