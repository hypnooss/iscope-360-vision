"""
WorkerManager — Manages the Agent Worker via systemctl.

The Worker runs as an independent systemd service (iscope-agent.service).
The Supervisor controls it via systemctl start/stop/restart.
"""

import subprocess
import time
from pathlib import Path


class WorkerManager:
    """Manages the agent worker service lifecycle via systemctl."""

    SERVICE_NAME = "iscope-agent"

    def __init__(self, logger, install_dir: Path, health_file: Path, pid_file: Path):
        self.logger = logger
        self.install_dir = install_dir
        self.health_file = health_file
        # pid_file kept for interface compat but no longer used
        self.pid_file = pid_file

    # ------------------------------------------------------------------
    # Lifecycle (via systemctl)
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """Start the worker service. Returns True if started successfully."""
        if self.is_running():
            self.logger.info("[WorkerMgr] Worker já está rodando (systemd)")
            return True

        self.logger.info(f"[WorkerMgr] Iniciando serviço {self.SERVICE_NAME}")
        try:
            subprocess.run(
                ["systemctl", "start", self.SERVICE_NAME],
                check=True, capture_output=True, text=True, timeout=30,
            )
            self.logger.info(f"[WorkerMgr] Serviço {self.SERVICE_NAME} iniciado")
            return True
        except subprocess.CalledProcessError as e:
            self.logger.error(f"[WorkerMgr] Falha ao iniciar {self.SERVICE_NAME}: {e.stderr}")
            return False
        except Exception as e:
            self.logger.error(f"[WorkerMgr] Erro ao iniciar worker: {e}")
            return False

    def stop(self, timeout: int = 30) -> bool:
        """Stop the worker service."""
        if not self.is_running():
            self.logger.info("[WorkerMgr] Worker não está rodando")
            return True

        self.logger.info(f"[WorkerMgr] Parando serviço {self.SERVICE_NAME}...")
        try:
            subprocess.run(
                ["systemctl", "stop", self.SERVICE_NAME],
                check=True, capture_output=True, text=True, timeout=timeout + 5,
            )
            self.logger.info(f"[WorkerMgr] Serviço {self.SERVICE_NAME} parado")
            return True
        except subprocess.CalledProcessError as e:
            self.logger.error(f"[WorkerMgr] Falha ao parar {self.SERVICE_NAME}: {e.stderr}")
            return False
        except Exception as e:
            self.logger.error(f"[WorkerMgr] Erro ao parar worker: {e}")
            return False

    def restart(self) -> bool:
        """Restart the worker service."""
        self.logger.info(f"[WorkerMgr] Reiniciando serviço {self.SERVICE_NAME}...")
        try:
            subprocess.run(
                ["systemctl", "restart", self.SERVICE_NAME],
                check=True, capture_output=True, text=True, timeout=60,
            )
            self.logger.info(f"[WorkerMgr] Serviço {self.SERVICE_NAME} reiniciado")
            return True
        except subprocess.CalledProcessError as e:
            self.logger.error(f"[WorkerMgr] Falha ao reiniciar {self.SERVICE_NAME}: {e.stderr}")
            return False
        except Exception as e:
            self.logger.error(f"[WorkerMgr] Erro ao reiniciar worker: {e}")
            return False

    # ------------------------------------------------------------------
    # Health checks
    # ------------------------------------------------------------------

    def is_running(self) -> bool:
        """Check if the worker service is active via systemctl."""
        try:
            result = subprocess.run(
                ["systemctl", "is-active", self.SERVICE_NAME],
                capture_output=True, text=True, timeout=10,
            )
            return result.stdout.strip() == "active"
        except Exception:
            return False

    def is_healthy(self, max_age_seconds: int = 300) -> bool:
        """Check if the worker wrote a recent health file."""
        if not self.is_running():
            return False

        if not self.health_file.exists():
            return False

        try:
            age = time.time() - self.health_file.stat().st_mtime
            return age < max_age_seconds
        except Exception:
            return False

    def collect_output(self, max_lines: int = 50) -> str:
        """No-op: logs go directly to journald for iscope-agent unit."""
        return ""
