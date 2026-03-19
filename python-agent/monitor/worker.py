"""
MonitorWorker — daemon thread that periodically collects metrics and sends them to the backend.
"""

import json
import threading
import time
from pathlib import Path
from typing import Optional

from monitor.collector import MetricsCollector
from monitor.version import get_version


MONITOR_SNAPSHOT_FILE = Path("/var/lib/iscope-agent/monitor.json")


class MonitorWorker(threading.Thread):
    """
    Daemon thread managed by the Supervisor.

    Collects system metrics at a configurable interval and POSTs them
    to the backend via the shared APIClient.
    """

    def __init__(self, api, state, logger, interval: int = 60, disk_path: str = "/"):
        super().__init__(daemon=True, name="MonitorWorker")
        self._api = api
        self._state = state
        self._logger = logger
        self._interval = max(interval, 10)  # minimum 10s
        self._collector = MetricsCollector(disk_path=disk_path)
        self._stop_event = threading.Event()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def run(self):
        self._logger.info(
            f"[Monitor] Iniciado (intervalo={self._interval}s, versão={get_version()})"
        )
        # First collection warms up CPU/net deltas — discard results
        self._collector.collect()
        time.sleep(min(self._interval, 5))

        consecutive_errors = 0

        while not self._stop_event.is_set():
            try:
                metrics = self._collector.collect()
                metrics["monitor_version"] = get_version()
                metrics["agent_id"] = str(self._state.data.get("agent_id", ""))

                # Save local snapshot
                self._save_snapshot(metrics)

                # Send to backend
                self._send(metrics)
                consecutive_errors = 0

            except Exception as e:
                consecutive_errors += 1
                self._logger.error(f"[Monitor] Erro na coleta/envio: {e}")

                # Back off on repeated failures
                if consecutive_errors >= 5:
                    backoff = min(consecutive_errors * 10, 300)
                    self._logger.warning(
                        f"[Monitor] {consecutive_errors} erros consecutivos, backoff {backoff}s"
                    )
                    self._stop_event.wait(backoff)
                    continue

            self._stop_event.wait(self._interval)

        self._logger.info("[Monitor] Thread encerrada.")

    def stop(self):
        """Signal the thread to stop gracefully."""
        self._stop_event.set()

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _send(self, metrics: dict):
        """POST metrics to the agent-monitor edge function."""
        try:
            resp = self._api.post("/agent-monitor", json=metrics)
            if resp and resp.status_code and resp.status_code >= 400:
                self._logger.warning(
                    f"[Monitor] Backend retornou {resp.status_code}"
                )
        except Exception as e:
            self._logger.warning(f"[Monitor] Falha ao enviar métricas: {e}")

    def _save_snapshot(self, metrics: dict):
        """Persist latest metrics locally for debug / health checks."""
        try:
            MONITOR_SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
            MONITOR_SNAPSHOT_FILE.write_text(
                json.dumps(metrics, default=str), encoding="utf-8"
            )
        except Exception:
            pass
