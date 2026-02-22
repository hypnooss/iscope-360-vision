import json
import threading
from pathlib import Path


class AgentState:
    def __init__(self, path: str):
        self.path = Path(path)
        self.data = {}
        self._lock = threading.Lock()

    def load(self):
        with self._lock:
            if not self.path.exists():
                raise FileNotFoundError(f"State file not found: {self.path}")
            self.data = json.loads(self.path.read_text())
            return self.data

    def save(self):
        with self._lock:
            self.path.write_text(json.dumps(self.data, indent=2))

    def is_registered(self) -> bool:
        with self._lock:
            return bool(self.data.get("agent_id"))
