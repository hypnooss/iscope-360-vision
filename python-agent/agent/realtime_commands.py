"""
Shell Command Poller — High-frequency HTTP polling for remote commands.

Replaces the previous WebSocket-based RealtimeCommandListener with a simple
HTTP polling loop that checks for pending commands every 2 seconds.

Architecture:
- Started on-demand when shell_session_active=true (via heartbeat flag)
- Polls GET /agent-commands every 2 seconds
- Reuses the existing RemoteCommandHandler for execution
- Auto-stops after 120s of inactivity (no commands found)
- Supervisor manages lifecycle based on heartbeat response
"""

import time
import threading

POLL_INTERVAL = 2  # seconds
INACTIVITY_TIMEOUT = 120  # seconds


class ShellCommandPoller:
    """Polls for pending shell commands at high frequency when shell is active."""

    def __init__(self, command_handler, logger):
        self.handler = command_handler
        self.logger = logger
        self._thread = None
        self._stop_event = threading.Event()
        self._last_activity = time.time()
        self._timed_out = False

    @property
    def timed_out(self):
        """Check if the poller stopped due to inactivity timeout."""
        return self._timed_out

    def start(self):
        """Start the poller in a daemon thread."""
        self._timed_out = False
        self._last_activity = time.time()
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._poll_loop, daemon=True, name="shell-poller"
        )
        self._thread.start()
        self.logger.info("[ShellPoll] Poller iniciado (intervalo: 2s, timeout: 120s)")

    def stop(self):
        """Stop the poller."""
        self._stop_event.set()
        self.logger.info("[ShellPoll] Poller parado")

    def _poll_loop(self):
        """Main polling loop. Exits on stop or inactivity timeout."""
        while not self._stop_event.is_set():
            # Check inactivity timeout
            if time.time() - self._last_activity > INACTIVITY_TIMEOUT:
                self.logger.info(
                    f"[ShellPoll] Nenhum comando em {INACTIVITY_TIMEOUT}s. "
                    "Encerrando por inatividade."
                )
                self._timed_out = True
                break

            try:
                found = self._poll_once()
                if found:
                    self._last_activity = time.time()
            except Exception as e:
                self.logger.error(f"[ShellPoll] Erro no polling: {e}")

            self._stop_event.wait(timeout=POLL_INTERVAL)

    def _poll_once(self) -> bool:
        """Poll for commands once. Returns True if commands were found."""
        try:
            response = self.handler.api.get("/agent-commands")
            commands = response.get("commands", [])

            if not commands:
                return False

            self.logger.info(f"[ShellPoll] {len(commands)} comando(s) encontrado(s)")

            for cmd in commands:
                self.handler._execute_command(cmd)

            return True

        except Exception as e:
            self.logger.error(f"[ShellPoll] Erro ao buscar comandos: {e}")
            return False
