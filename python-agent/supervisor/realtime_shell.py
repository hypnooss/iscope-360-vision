"""
Realtime Shell — Bidirectional WebSocket shell via Supabase Realtime Broadcast.

Architecture:
- Connects to Supabase Realtime via WebSocket
- Joins broadcast channel `shell:{agent_id}`
- Receives "command" events from the UI
- Executes via Popen with PTY for real terminal emulation
- Sends "output", "error", "done" events back to the UI
- Auto-disconnects after 120s of inactivity
- Supervisor manages lifecycle based on heartbeat response
"""

import fcntl
import json
import os
import pty
import signal
import subprocess
import select
import threading
import time
import uuid

import websocket

INACTIVITY_TIMEOUT = 120  # seconds
STREAM_INTERVAL = 0.1  # seconds between partial output broadcasts
READ_CHUNK = 4096  # bytes per PTY read


class RealtimeShell:
    """Bidirectional shell over Supabase Realtime Broadcast channel."""

    def __init__(self, supabase_url: str, anon_key: str, agent_id: str, logger):
        self.supabase_url = supabase_url.rstrip("/")
        self.anon_key = anon_key
        self.agent_id = agent_id
        self.logger = logger

        self._ws = None
        self._thread = None
        self._stop_event = threading.Event()
        self._last_activity = time.time()
        self._timed_out = False
        self._session_closed = False
        self._cwd = "/"
        self._running_proc = None
        self._running_cmd_id = None
        self._channel_topic = f"shell:{agent_id}"
        self._joined = False

    @property
    def timed_out(self):
        return self._timed_out

    @property
    def session_closed(self):
        return self._session_closed

    def start(self):
        """Start the WebSocket connection in a daemon thread."""
        self._timed_out = False
        self._session_closed = False
        self._last_activity = time.time()
        self._stop_event.clear()
        self._joined = False

        self._thread = threading.Thread(
            target=self._run, daemon=True, name="realtime-shell"
        )
        self._thread.start()
        self.logger.info("[RealtimeShell] Iniciando conexão WebSocket...")

    def stop(self):
        """Stop the WebSocket connection."""
        self._stop_event.set()
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
        self.logger.info("[RealtimeShell] Parado")

    def _build_ws_url(self) -> str:
        """Build Supabase Realtime WebSocket URL."""
        base = self.supabase_url.replace("https://", "wss://").replace("http://", "ws://")
        return f"{base}/realtime/v1/websocket?apikey={self.anon_key}&vsn=1.0.0"

    def _run(self):
        """Main WebSocket loop with auto-reconnect."""
        while not self._stop_event.is_set():
            try:
                self._connect_and_listen()
            except Exception as e:
                if self._stop_event.is_set():
                    break
                self.logger.error(f"[RealtimeShell] Erro na conexão WebSocket: {e}")
                self._stop_event.wait(timeout=5)

    def _connect_and_listen(self):
        """Connect to Supabase Realtime and listen for events."""
        url = self._build_ws_url()
        self.logger.info(f"[RealtimeShell] Conectando ao Supabase Realtime...")

        self._ws = websocket.WebSocketApp(
            url,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close,
        )

        heartbeat_thread = threading.Thread(
            target=self._phoenix_heartbeat, daemon=True, name="phoenix-hb"
        )
        heartbeat_thread.start()

        self._ws.run_forever(ping_interval=30, ping_timeout=10)

    def _on_open(self, ws):
        """WebSocket opened — join the broadcast channel."""
        self.logger.info("[RealtimeShell] WebSocket conectado, joining channel...")
        self._join_channel()

    def _join_channel(self):
        """Send Phoenix join message for the broadcast channel."""
        join_msg = json.dumps({
            "topic": f"realtime:{self._channel_topic}",
            "event": "phx_join",
            "payload": {
                "config": {
                    "broadcast": {"self": True},
                    "presence": {"key": ""},
                }
            },
            "ref": "join-ref",
        })
        try:
            self._ws.send(join_msg)
            self.logger.info(f"[RealtimeShell] Join enviado para canal {self._channel_topic}")
        except Exception as e:
            self.logger.error(f"[RealtimeShell] Erro ao enviar join: {e}")

    def _on_message(self, ws, message):
        """Handle incoming WebSocket messages."""
        try:
            msg = json.loads(message)
        except Exception:
            return

        event = msg.get("event")
        topic = msg.get("topic", "")
        payload = msg.get("payload", {})

        if event == "phx_reply" and msg.get("ref") == "join-ref":
            status = payload.get("status")
            if status == "ok":
                self._joined = True
                self._last_activity = time.time()
                self.logger.info("[RealtimeShell] ✅ Canal joined com sucesso! Enviando ready...")
                # Emit ready event so the UI knows the agent is connected
                self._broadcast("ready", {"agent_id": self.agent_id})
                self.logger.info("[RealtimeShell] ✅ Evento 'ready' enviado ao canal.")
            else:
                self.logger.error(f"[RealtimeShell] ❌ Falha no join: {payload}")
            return

        if event == "broadcast" and topic == f"realtime:{self._channel_topic}":
            inner_event = payload.get("event")
            inner_payload = payload.get("payload", {})

            if inner_event == "command":
                self._last_activity = time.time()
                self._handle_command(inner_payload)
            elif inner_event == "signal":
                self._last_activity = time.time()
                self._handle_signal(inner_payload)
            elif inner_event == "disconnect":
                self.logger.info("[RealtimeShell] Sessão encerrada pelo GUI.")
                self._session_closed = True
                self._stop_event.set()

    def _on_error(self, ws, error):
        if not self._stop_event.is_set():
            self.logger.error(f"[RealtimeShell] WebSocket erro: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        self._joined = False
        if not self._stop_event.is_set():
            self.logger.info(f"[RealtimeShell] WebSocket fechado (code={close_status_code})")

    def _phoenix_heartbeat(self):
        """Send Phoenix heartbeat every 30s to keep connection alive."""
        while not self._stop_event.is_set():
            self._stop_event.wait(timeout=30)
            if self._stop_event.is_set():
                break

            if time.time() - self._last_activity > INACTIVITY_TIMEOUT:
                self.logger.info(
                    f"[RealtimeShell] Nenhuma atividade em {INACTIVITY_TIMEOUT}s. "
                    "Encerrando por inatividade."
                )
                self._timed_out = True
                self._stop_event.set()
                if self._ws:
                    try:
                        self._ws.close()
                    except Exception:
                        pass
                break

            try:
                if self._ws and self._joined:
                    hb = json.dumps({
                        "topic": "phoenix",
                        "event": "heartbeat",
                        "payload": {},
                        "ref": "hb",
                    })
                    self._ws.send(hb)
            except Exception:
                pass

    def _broadcast(self, event: str, payload: dict):
        """Send a broadcast event to the channel."""
        if not self._ws or not self._joined:
            return
        msg = json.dumps({
            "topic": f"realtime:{self._channel_topic}",
            "event": "broadcast",
            "payload": {
                "type": "broadcast",
                "event": event,
                "payload": payload,
            },
            "ref": None,
        })
        try:
            self._ws.send(msg)
        except Exception as e:
            self.logger.error(f"[RealtimeShell] Erro ao enviar broadcast: {e}")

    def _handle_command(self, payload: dict):
        """Execute a command received via broadcast."""
        command_text = payload.get("command", "").strip()
        command_id = payload.get("id", str(uuid.uuid4()))

        if not command_text:
            return

        self.logger.info(f"[RealtimeShell] 📥 Comando recebido (id={command_id[:8]}): {command_text[:80]}")

        t = threading.Thread(
            target=self._execute_command,
            args=(command_id, command_text),
            daemon=True,
            name=f"cmd-{command_id[:8]}",
        )
        t.start()

    def _handle_signal(self, payload: dict):
        """Handle signal (e.g. Ctrl+C) from the UI."""
        sig_name = payload.get("signal", "SIGINT")
        self.logger.info(f"[RealtimeShell] Signal recebido: {sig_name}")

        if self._running_proc and self._running_proc.poll() is None:
            try:
                pid = self._running_proc.pid
                pgid = os.getpgid(pid)
                os.killpg(pgid, signal.SIGINT)
                self.logger.info(f"[RealtimeShell] SIGINT enviado ao grupo {pgid}")

                time.sleep(0.8)
                if self._running_proc.poll() is None:
                    os.killpg(pgid, signal.SIGTERM)
                    time.sleep(0.8)

                if self._running_proc.poll() is None:
                    os.killpg(pgid, signal.SIGKILL)
            except Exception as e:
                self.logger.warning(f"[RealtimeShell] Erro ao sinalizar: {e}")
                try:
                    self._running_proc.terminate()
                    time.sleep(0.5)
                    if self._running_proc.poll() is None:
                        self._running_proc.kill()
                except Exception:
                    pass

    def _execute_command(self, command_id: str, command_text: str):
        """Execute a command with PTY-based streaming output via broadcast."""
        master_fd = None
        slave_fd = None
        try:
            stripped = command_text.strip()

            # Handle "cd" commands
            if stripped == "cd" or stripped == "cd ~":
                home = os.path.expanduser("~")
                if os.path.isdir(home):
                    self._cwd = home
                self._broadcast("done", {
                    "id": command_id,
                    "exit_code": 0,
                    "cwd": self._cwd,
                })
                return

            if stripped.startswith("cd "):
                target = stripped[3:].strip()
                result = subprocess.run(
                    f"cd {target} && pwd",
                    shell=True, capture_output=True, text=True,
                    cwd=self._cwd, timeout=5,
                )
                if result.returncode == 0:
                    self._cwd = result.stdout.strip()
                    self._broadcast("done", {
                        "id": command_id,
                        "exit_code": 0,
                        "cwd": self._cwd,
                    })
                else:
                    self._broadcast("error", {
                        "id": command_id,
                        "data": result.stderr.strip(),
                    })
                    self._broadcast("done", {
                        "id": command_id,
                        "exit_code": result.returncode,
                        "cwd": self._cwd,
                    })
                return

            # --- PTY-based execution ---
            master_fd, slave_fd = pty.openpty()

            # Set master to non-blocking
            fl = fcntl.fcntl(master_fd, fcntl.F_GETFL)
            fcntl.fcntl(master_fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

            proc = subprocess.Popen(
                stripped,
                shell=True,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=self._cwd,
                preexec_fn=os.setsid,
                close_fds=True,
            )

            # Close slave in parent — only the child uses it
            os.close(slave_fd)
            slave_fd = None

            self._running_proc = proc
            self._running_cmd_id = command_id

            # Stream output from PTY master
            timeout = 120  # max command runtime
            start_time = time.time()

            while proc.poll() is None:
                if time.time() - start_time > timeout:
                    try:
                        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                    except Exception:
                        proc.kill()
                    proc.wait()
                    self._broadcast("error", {
                        "id": command_id,
                        "data": f"\nCommand timed out after {timeout}s",
                    })
                    self._broadcast("done", {
                        "id": command_id,
                        "exit_code": -1,
                        "cwd": self._cwd,
                    })
                    return

                data = self._read_pty(master_fd)
                if data:
                    self._last_activity = time.time()
                    self.logger.debug(f"[RealtimeShell] 📤 Output ({len(data)} chars) cmd={command_id[:8]}")
                    self._broadcast("output", {
                        "id": command_id,
                        "data": data,
                    })

                time.sleep(STREAM_INTERVAL)

            # Read remaining output after process exits
            time.sleep(0.1)
            remaining = self._read_pty(master_fd)
            if remaining:
                self._broadcast("output", {
                    "id": command_id,
                    "data": remaining,
                })

            self._broadcast("done", {
                "id": command_id,
                "exit_code": proc.returncode,
                "cwd": self._cwd,
            })

            self.logger.info(
                f"[RealtimeShell] Comando {command_id[:8]}... finalizado (exit={proc.returncode})"
            )

        except Exception as e:
            self.logger.error(f"[RealtimeShell] Erro ao executar comando: {e}")
            self._broadcast("error", {
                "id": command_id,
                "data": str(e),
            })
            self._broadcast("done", {
                "id": command_id,
                "exit_code": -1,
                "cwd": self._cwd,
            })
        finally:
            if self._running_cmd_id == command_id:
                self._running_proc = None
                self._running_cmd_id = None
            # Clean up PTY file descriptors
            if master_fd is not None:
                try:
                    os.close(master_fd)
                except OSError:
                    pass
            if slave_fd is not None:
                try:
                    os.close(slave_fd)
                except OSError:
                    pass

    @staticmethod
    def _read_pty(master_fd: int) -> str:
        """Read all available data from PTY master fd without blocking."""
        output = b""
        try:
            while True:
                ready, _, _ = select.select([master_fd], [], [], 0.05)
                if not ready:
                    break
                try:
                    chunk = os.read(master_fd, READ_CHUNK)
                    if not chunk:
                        break
                    output += chunk
                except OSError:
                    break
        except Exception:
            pass
        return output.decode("utf-8", errors="replace") if output else ""
