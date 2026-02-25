import threading
import time

from agent.heartbeat import AgentStopped
from agent.updater import AutoUpdater


class HeartbeatWorker(threading.Thread):
    """Daemon thread that sends heartbeats and refreshes tokens independently of task execution."""

    def __init__(self, api, auth, heartbeat, state, updater: AutoUpdater, logger, default_interval=120):
        super().__init__(daemon=True, name="heartbeat-worker")
        self.api = api
        self.auth = auth
        self.heartbeat = heartbeat
        self.state = state
        self.updater = updater
        self.logger = logger
        self.default_interval = default_interval
        self.stop_event = threading.Event()
        self._has_pending_tasks = threading.Event()

    @property
    def should_stop(self):
        return self.stop_event.is_set()

    def signal_has_pending_tasks(self):
        """Called by the main loop when there are pending tasks (defer updates)."""
        self._has_pending_tasks.set()

    def clear_pending_tasks(self):
        self._has_pending_tasks.clear()

    def run(self):
        self.logger.info("HeartbeatWorker iniciado")

        while not self.stop_event.is_set():
            interval = self.default_interval
            try:
                # 1. Proactively refresh token if close to expiry
                if not self.auth.is_access_token_valid():
                    self.logger.info("[HB Worker] Token próximo de expirar, renovando...")
                    self.auth.refresh_tokens()

                # 2. Send heartbeat
                result = self.heartbeat.send(status="running")

                interval = result.get("next_heartbeat_in", self.default_interval)

                self.logger.info(
                    f"[HB Worker] Heartbeat OK | "
                    f"config_flag={result.get('config_flag')} | "
                    f"has_pending_tasks={result.get('has_pending_tasks')} | "
                    f"update={result.get('update_available')} | "
                    f"next={interval}s"
                )

                # 3. Handle component check request
                self._handle_check_components(result)

                # 4. Handle update availability
                self._handle_update(result)

            except AgentStopped as e:
                self.logger.critical(f"[HB Worker] Agent parado: {e}")
                self.stop_event.set()
                break

            except RuntimeError as e:
                msg = str(e)
                if "TOKEN_EXPIRED" in msg:
                    self.logger.info("[HB Worker] Token expirado, renovando...")
                    try:
                        self.auth.refresh_tokens()
                    except Exception as refresh_err:
                        self.logger.error(f"[HB Worker] Falha ao renovar token: {refresh_err}")
                else:
                    self.logger.error(f"[HB Worker] Erro no heartbeat: {e}")

            except Exception as e:
                self.logger.error(f"[HB Worker] Erro inesperado: {e}")

            # Sleep in small increments so we can respond to stop_event quickly
            self._interruptible_sleep(interval)

        self.logger.info("HeartbeatWorker encerrado")

    def _interruptible_sleep(self, seconds):
        """Sleep that can be interrupted by stop_event."""
        self.stop_event.wait(timeout=seconds)

    def _handle_check_components(self, result):
        """Handle backend request for component verification."""
        if not result.get('check_components'):
            return

        self.logger.info("[HB Worker] Backend solicitou verificação de componentes")
        try:
            from pathlib import Path
            import subprocess

            flag_file = Path("/var/lib/iscope-agent/check_components.flag")
            flag_file.touch()
            self.logger.info("[HB Worker] Flag de verificação criada. Solicitando restart...")

            proc = subprocess.run(
                ['sudo', 'systemctl', 'restart', 'iscope-supervisor'],
                capture_output=True,
                timeout=30
            )
            if proc.returncode != 0:
                stderr = proc.stderr.decode() if proc.stderr else ''
                self.logger.warning(f"[HB Worker] Falha ao reiniciar serviço: {stderr}")
        except Exception as e:
            self.logger.warning(f"[HB Worker] Erro ao solicitar verificação de componentes: {e}")

    def _handle_update(self, result):
        """Handle update availability from heartbeat response."""
        if not result.get('update_available') or not result.get('update_info'):
            return

        self.logger.info("[HB Worker] Atualização disponível detectada")
        update_info = result['update_info']

        # Force update or no pending tasks: proceed
        if update_info.get('force') or not self._has_pending_tasks.is_set():
            self.logger.info(f"[HB Worker] Iniciando update para v{update_info.get('version')}")
            self.updater.check_and_update(update_info)
        else:
            self.logger.info("[HB Worker] Adiando update — há tarefas pendentes")
