"""Supervisor configuration — reads from the same env files as the agent."""

import os
from pathlib import Path

from dotenv import load_dotenv


def _load_env():
    default_env_path = Path("/etc/iscope/agent.env")
    if default_env_path.exists():
        load_dotenv(str(default_env_path))
    load_dotenv()


_load_env()

API_BASE_URL = os.getenv("AGENT_API_BASE_URL")
STATE_FILE = os.getenv("AGENT_STATE_FILE", "/var/lib/iscope/state.json")
HEARTBEAT_INTERVAL = int(os.getenv("SUPERVISOR_HEARTBEAT_INTERVAL", "120"))
WORKER_INSTALL_DIR = Path(os.getenv("AGENT_INSTALL_DIR", "/opt/iscope-agent"))
WORKER_HEALTH_FILE = Path("/var/lib/iscope-agent/worker.health")
WORKER_PID_FILE = Path("/var/lib/iscope-agent/worker.pid")

# Monitor is now an independent service (iscope-monitor.service)
# MONITOR_INTERVAL moved to monitor/main.py

# Supabase Realtime (for instant remote commands)
SUPABASE_URL = os.getenv("SUPABASE_URL")  # ex: https://akbosdbyheezghieiefz.supabase.co
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
