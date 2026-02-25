"""
Remote Commands — Execute shell commands received from the backend.

Flow:
1. Heartbeat returns has_pending_commands=True
2. Agent GETs /agent-commands → list of pending commands
3. Executes each via subprocess.Popen (with streaming support)
4. POSTs result (stdout, stderr, exit_code, cwd) back
"""

import os
import subprocess
import threading
import time
import select


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

            # Strip __probe__ prefix (silent readiness check from UI)
            if stripped.startswith("__probe__ "):
                stripped = stripped[len("__probe__ "):]

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

            # Regular command — use Popen for streaming support
            self.logger.info(f"[RemoteCmd] Executando: {command_text[:80]}... (timeout={timeout}s, cwd={self._cwd})")

            proc = subprocess.Popen(
                command_text,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=self._cwd,
            )

            # Wait briefly for fast commands (1 second)
            try:
                stdout, stderr = proc.communicate(timeout=1.0)
                # Command finished quickly
                self._report_result(
                    command_id=command_id,
                    stdout=stdout,
                    stderr=stderr,
                    exit_code=proc.returncode,
                    status="completed" if proc.returncode == 0 else "failed",
                    cwd=self._cwd,
                )
                self.logger.info(
                    f"[RemoteCmd] Comando {command_id[:8]}... finalizado (exit={proc.returncode})"
                )
                return
            except subprocess.TimeoutExpired:
                pass  # Still running — switch to streaming mode

            # ── Streaming mode ──
            self.logger.info(f"[RemoteCmd] Comando {command_id[:8]}... entrando em modo streaming")
            accumulated_stdout = ""
            accumulated_stderr = ""
            last_output_time = time.time()
            STREAM_INTERVAL = 2  # seconds between partial reports

            while proc.poll() is None:
                elapsed_since_last_output = time.time() - last_output_time
                if elapsed_since_last_output > timeout:
                    proc.kill()
                    proc.wait()
                    self.logger.warning(f"[RemoteCmd] Comando {command_id[:8]}... timeout ({timeout}s)")
                    self._report_result(
                        command_id=command_id,
                        stdout=accumulated_stdout,
                        stderr=accumulated_stderr + f"\nCommand timed out after {timeout} seconds",
                        exit_code=-1,
                        status="timeout",
                        cwd=self._cwd,
                    )
                    return

                # Non-blocking read using select
                partial_stdout = self._read_available(proc.stdout)
                partial_stderr = self._read_available(proc.stderr)

                if partial_stdout:
                    accumulated_stdout += partial_stdout
                if partial_stderr:
                    accumulated_stderr += partial_stderr

                if partial_stdout or partial_stderr:
                    last_output_time = time.time()
                    self._report_result(
                        command_id=command_id,
                        stdout=accumulated_stdout,
                        stderr=accumulated_stderr,
                        exit_code=None,
                        status="running",
                        cwd=self._cwd,
                    )

                time.sleep(STREAM_INTERVAL)

            # Process finished — read any remaining output
            remaining_stdout = proc.stdout.read() or ""
            remaining_stderr = proc.stderr.read() or ""
            accumulated_stdout += remaining_stdout
            accumulated_stderr += remaining_stderr

            self._report_result(
                command_id=command_id,
                stdout=accumulated_stdout,
                stderr=accumulated_stderr,
                exit_code=proc.returncode,
                status="completed" if proc.returncode == 0 else "failed",
                cwd=self._cwd,
            )

            self.logger.info(
                f"[RemoteCmd] Comando {command_id[:8]}... finalizado streaming (exit={proc.returncode})"
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

    @staticmethod
    def _read_available(pipe) -> str:
        """Read available data from a pipe without blocking, using select."""
        output = ""
        try:
            while True:
                ready, _, _ = select.select([pipe], [], [], 0.05)
                if not ready:
                    break
                line = pipe.readline()
                if not line:
                    break
                output += line
        except Exception:
            pass
        return output

    def _report_result(self, command_id: str, stdout: str, stderr: str, exit_code, status: str, cwd: str = "/"):
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
                    "exit_code": exit_code if exit_code is not None else -1,
                    "status": status,
                    "cwd": cwd,
                },
            )
        except Exception as e:
            self.logger.error(f"[RemoteCmd] Erro ao reportar resultado de {command_id[:8]}...: {e}")
