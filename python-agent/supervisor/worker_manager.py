"""
WorkerManager — Start/stop/restart the agent worker process.

The worker runs as a subprocess managed entirely by the Supervisor.
It does NOT have its own systemd unit; the Supervisor owns its lifecycle.
"""

import os
import signal
import subprocess
import time
from pathlib import Path
from typing import Optional


class WorkerManager:
    """Manages the agent worker process lifecycle."""

    def __init__(self, logger, install_dir: Path, health_file: Path, pid_file: Path):
        self.logger = logger
        self.install_dir = install_dir
        self.health_file = health_file
        self.pid_file = pid_file
        self._process: Optional[subprocess.Popen] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> bool:
        """Start the worker process. Returns True if started successfully."""
        if self.is_running():
            self.logger.info("[WorkerMgr] Worker já está rodando")
            return True

        venv_python = self.install_dir / "venv" / "bin" / "python"
        main_py = self.install_dir / "main.py"

        if not main_py.exists():
            self.logger.error(f"[WorkerMgr] main.py não encontrado em {self.install_dir}")
            return False

        python_bin = str(venv_python) if venv_python.exists() else "python3"

        self.logger.info(f"[WorkerMgr] Iniciando worker: {python_bin} {main_py}")

        try:
            self._process = subprocess.Popen(
                [python_bin, str(main_py)],
                cwd=str(self.install_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                # Inherit env so worker gets the same AGENT_* vars
                env={**os.environ},
            )
            self._write_pid(self._process.pid)
            self.logger.info(f"[WorkerMgr] Worker iniciado (PID {self._process.pid})")
            return True

        except Exception as e:
            self.logger.error(f"[WorkerMgr] Falha ao iniciar worker: {e}")
            return False

    def stop(self, timeout: int = 30) -> bool:
        """Gracefully stop the worker, escalating to SIGKILL if needed."""
        if not self.is_running():
            self.logger.info("[WorkerMgr] Worker não está rodando")
            self._cleanup_pid()
            return True

        pid = self._get_pid()
        self.logger.info(f"[WorkerMgr] Parando worker (PID {pid})...")

        try:
            # SIGTERM first
            if self._process:
                self._process.terminate()
            elif pid:
                os.kill(pid, signal.SIGTERM)

            # Wait for graceful shutdown
            deadline = time.time() + timeout
            while time.time() < deadline:
                if not self._is_pid_alive(pid):
                    self.logger.info("[WorkerMgr] Worker parou graciosamente")
                    self._cleanup_pid()
                    self._process = None
                    return True
                time.sleep(1)

            # Force kill
            self.logger.warning("[WorkerMgr] Worker não parou a tempo, enviando SIGKILL")
            if self._process:
                self._process.kill()
            elif pid:
                os.kill(pid, signal.SIGKILL)

            time.sleep(2)
            self._cleanup_pid()
            self._process = None
            return True

        except ProcessLookupError:
            self.logger.info("[WorkerMgr] Worker já havia encerrado")
            self._cleanup_pid()
            self._process = None
            return True
        except Exception as e:
            self.logger.error(f"[WorkerMgr] Erro ao parar worker: {e}")
            return False

    def restart(self) -> bool:
        """Stop then start the worker."""
        self.logger.info("[WorkerMgr] Reiniciando worker...")
        self.stop()
        time.sleep(2)
        return self.start()

    # ------------------------------------------------------------------
    # Health checks
    # ------------------------------------------------------------------

    def is_running(self) -> bool:
        """Check if the worker process is alive."""
        # Check via Popen handle first
        if self._process is not None:
            poll = self._process.poll()
            if poll is None:
                return True
            # Process exited
            self._process = None

        # Fallback: check PID file
        pid = self._get_pid()
        if pid and self._is_pid_alive(pid):
            return True

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
        """Read recent stdout from the worker (non-blocking)."""
        if self._process is None or self._process.stdout is None:
            return ""

        lines = []
        try:
            import select
            while select.select([self._process.stdout], [], [], 0)[0]:
                line = self._process.stdout.readline()
                if not line:
                    break
                lines.append(line.decode("utf-8", errors="replace").rstrip())
                if len(lines) >= max_lines:
                    break
        except Exception:
            pass

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _write_pid(self, pid: int) -> None:
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_file.write_text(str(pid))

    def _get_pid(self) -> Optional[int]:
        if self.pid_file.exists():
            try:
                return int(self.pid_file.read_text().strip())
            except (ValueError, OSError):
                pass
        return None

    def _cleanup_pid(self) -> None:
        try:
            self.pid_file.unlink(missing_ok=True)
            self.health_file.unlink(missing_ok=True)
        except Exception:
            pass

    @staticmethod
    def _is_pid_alive(pid: Optional[int]) -> bool:
        if pid is None:
            return False
        try:
            os.kill(pid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True  # Process exists but we can't signal it
