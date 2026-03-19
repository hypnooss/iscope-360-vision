"""
MonitorWorker — kept for backward compatibility during transition.

The Monitor now runs as an independent systemd service (iscope-monitor.service).
See monitor/main.py for the standalone entrypoint.

This module is kept so that old supervisor code importing MonitorWorker
does not crash during the transition period.
"""

import threading


class MonitorWorker(threading.Thread):
    """
    Deprecated: Monitor now runs as iscope-monitor.service.
    This stub exists only for backward compatibility.
    """

    def __init__(self, **kwargs):
        super().__init__(daemon=True, name="MonitorWorker")
        self._stop_event = threading.Event()

    def run(self):
        # No-op: monitor runs as independent service
        self._stop_event.wait()

    def stop(self):
        self._stop_event.set()

    def start(self):
        # No-op: don't start a thread
        pass
