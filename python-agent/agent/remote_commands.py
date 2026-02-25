"""
Remote Commands — Execute shell commands received from the backend.

Flow:
1. Heartbeat returns has_pending_commands=True
2. Agent GETs /agent-commands → list of pending commands
3. Executes each via subprocess.run(shell=True, timeout=N)
4. POSTs result (stdout, stderr, exit_code, cwd) back
"""

import os
import subprocess
import threading


class RemoteCommandHandler:
    def __init__(self, api, logger):
        self.api = api
        self.logger = logger
        self._running_ids = set()
        self._lock = threading.Lock()
        self._cwd = "/"  # Persistent working directory

    def process_pending_commands(self):
        """Fetch and execute all pending commands."""
        try:
            response = self.api.get("/agent-commands")
            commands = response.get("commands", [])

            if not commands:
                self.logger.info("[RemoteCmd] Nenhum comando pendente")
                return

            self.logger.info(f"[RemoteCmd] {len(commands)} comando(s) pendente(s)")

            for cmd in commands:
                self._execute_command(cmd)

        except Exception as e:
            self.logger.error(f"[RemoteCmd] Erro ao buscar comandos: {e}")

    def _execute_command(self, cmd: dict):
        """Execute a single command and report results."""
        command_id = cmd["id"]
        command_text = cmd["command"]
        timeout = cmd.get("timeout_seconds", 60)

        # Deduplication: prevent the same command from running twice
        with self._lock:
            if command_id in self._running_ids:
                self.logger.info(f"[RemoteCmd] Comando {command_id[:8]}... já em execução, ignorando duplicata")
                return
            self._running_ids.add(command_id)

        try:
            stripped = command_text.strip()

            # Handle bare "cd" (go to home/root)
            if stripped == "cd" or stripped == "cd ~":
                home = os.path.expanduser("~")
                if os.path.isdir(home):
                    self._cwd = home
                self._report_result(
                    command_id=command_id,
                    stdout="",
                    stderr="",
                    exit_code=0,
                    status="completed",
                    cwd=self._cwd,
                )
                self.logger.info(f"[RemoteCmd] cd → {self._cwd}")
                return

            # Handle "cd <path>"
            if stripped.startswith("cd "):
                target = stripped[3:].strip()
                result = subprocess.run(
                    f"cd {target} && pwd",
                    shell=True,
                    capture_output=True,
                    text=True,
                    cwd=self._cwd,
                    timeout=5,
                )
                if result.returncode == 0:
                    self._cwd = result.stdout.strip()
                    self._report_result(
                        command_id=command_id,
                        stdout="",
                        stderr="",
                        exit_code=0,
                        status="completed",
                        cwd=self._cwd,
                    )
                    self.logger.info(f"[RemoteCmd] cd → {self._cwd}")
                else:
                    self._report_result(
                        command_id=command_id,
                        stdout="",
                        stderr=result.stderr.strip(),
                        exit_code=result.returncode,
                        status="failed",
                        cwd=self._cwd,
                    )
                return

            # Regular command — run in persistent cwd
            self.logger.info(f"[RemoteCmd] Executando: {command_text[:80]}... (timeout={timeout}s, cwd={self._cwd})")

            result = subprocess.run(
                command_text,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=self._cwd,
            )

            self._report_result(
                command_id=command_id,
                stdout=result.stdout,
                stderr=result.stderr,
                exit_code=result.returncode,
                status="completed" if result.returncode == 0 else "failed",
                cwd=self._cwd,
            )

            self.logger.info(
                f"[RemoteCmd] Comando {command_id[:8]}... finalizado (exit={result.returncode})"
            )

        except subprocess.TimeoutExpired:
            self.logger.warning(f"[RemoteCmd] Comando {command_id[:8]}... timeout ({timeout}s)")
            self._report_result(
                command_id=command_id,
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                exit_code=-1,
                status="timeout",
                cwd=self._cwd,
            )

        except Exception as e:
            self.logger.error(f"[RemoteCmd] Erro ao executar comando {command_id[:8]}...: {e}")
            self._report_result(
                command_id=command_id,
                stdout="",
                stderr=str(e),
                exit_code=-1,
                status="failed",
                cwd=self._cwd,
            )

        finally:
            with self._lock:
                self._running_ids.discard(command_id)

    def _report_result(self, command_id: str, stdout: str, stderr: str, exit_code: int, status: str, cwd: str = "/"):
        """Send command result back to the backend."""
        try:
            # Truncate output to avoid huge payloads (max 64KB each)
            max_len = 65536
            self.api.post(
                "/agent-commands",
                json={
                    "command_id": command_id,
                    "stdout": stdout[:max_len] if stdout else "",
                    "stderr": stderr[:max_len] if stderr else "",
                    "exit_code": exit_code,
                    "status": status,
                    "cwd": cwd,
                },
            )
        except Exception as e:
            self.logger.error(f"[RemoteCmd] Erro ao reportar resultado de {command_id[:8]}...: {e}")
