"""
Realtime Command Listener — WebSocket-based instant command execution.

Uses Supabase Realtime Broadcast channels to receive commands instantly
instead of waiting for heartbeat polling (~120s).

Architecture:
- Connects via raw WebSocket to Supabase Realtime (Phoenix protocol)
- Subscribes to a broadcast channel specific to this agent
- Frontend broadcasts command payload when inserting into agent_commands
- Agent receives, executes, and reports result via REST API
- Heartbeat remains as fallback for missed commands

Protocol: Phoenix Channels over WebSocket
- Connect to wss://<ref>.supabase.co/realtime/v1/websocket?apikey=<key>&vsn=1.0.0
- Messages: [join_ref, ref, topic, event, payload]
"""

import json
import time
import threading

try:
    import websocket  # websocket-client library
    HAS_WEBSOCKET = True
except ImportError:
    HAS_WEBSOCKET = False


class RealtimeCommandListener:
    """Listens for commands via Supabase Realtime Broadcast channel."""

    def __init__(self, agent_id, supabase_url, supabase_key, command_handler, logger):
        """
        Args:
            agent_id: UUID of this agent
            supabase_url: Supabase project URL (https://xxx.supabase.co)
            supabase_key: Supabase anon key
            command_handler: RemoteCommandHandler instance (has _execute_command)
            logger: Logger instance
        """
        self.agent_id = agent_id
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.handler = command_handler
        self.logger = logger
        self._thread = None
        self._stop_event = threading.Event()
        self._ref_counter = 0
        self._ws = None
        self._heartbeat_thread = None

        # Build WebSocket URL
        # Convert https:// to wss://
        ws_base = supabase_url.replace("https://", "wss://").replace("http://", "ws://")
        self.ws_url = f"{ws_base}/realtime/v1/websocket?apikey={supabase_key}&vsn=1.0.0"
        self.topic = f"realtime:agent-cmd-{agent_id}"

    def start(self):
        """Start the listener in a daemon thread."""
        if not HAS_WEBSOCKET:
            self.logger.warning(
                "[Realtime] websocket-client não instalado. "
                "Comandos remotos usarão apenas heartbeat (fallback)."
            )
            return

        if not self.supabase_url or not self.supabase_key:
            self.logger.warning(
                "[Realtime] SUPABASE_URL ou SUPABASE_ANON_KEY não configurados. "
                "Comandos remotos usarão apenas heartbeat (fallback)."
            )
            return

        self._thread = threading.Thread(target=self._listen_loop, daemon=True, name="realtime-cmd")
        self._thread.start()
        self.logger.info(f"[Realtime] Listener iniciado para agent {self.agent_id[:8]}...")

    def stop(self):
        """Stop the listener."""
        self._stop_event.set()
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass

    def _next_ref(self):
        self._ref_counter += 1
        return str(self._ref_counter)

    def _send(self, ws, topic, event, payload, join_ref=None):
        """Send a Phoenix protocol message."""
        msg = json.dumps([join_ref, self._next_ref(), topic, event, payload])
        ws.send(msg)

    def _listen_loop(self):
        """Main loop with automatic reconnection and exponential backoff."""
        backoff = 2
        max_backoff = 60

        while not self._stop_event.is_set():
            try:
                self._connect_and_listen()
            except Exception as e:
                if self._stop_event.is_set():
                    break
                self.logger.warning(f"[Realtime] Conexão perdida: {e}. Reconectando em {backoff}s...")
                time.sleep(backoff)
                backoff = min(backoff * 2, max_backoff)
            else:
                # Clean disconnect, reset backoff
                backoff = 2

    def _connect_and_listen(self):
        """Connect to Supabase Realtime and listen for broadcasts."""
        self.logger.info(f"[Realtime] Conectando ao Supabase Realtime...")

        ws = websocket.WebSocket()
        ws.settimeout(40)  # Slightly longer than heartbeat interval (30s)
        ws.connect(self.ws_url)
        self._ws = ws

        self.logger.info(f"[Realtime] Conectado. Joining channel {self.topic}")

        # Join the broadcast channel
        join_ref = self._next_ref()
        join_payload = {
            "config": {
                "broadcast": {"self": False},
                "presence": {"key": ""},
                "postgres_changes": []
            }
        }
        self._send(ws, self.topic, "phx_join", join_payload, join_ref=join_ref)

        # Start Phoenix heartbeat thread
        self._start_phoenix_heartbeat(ws)

        # Reset backoff on successful connection
        self.logger.info("[Realtime] Channel joined, aguardando comandos...")

        while not self._stop_event.is_set():
            try:
                raw = ws.recv()
                if not raw:
                    continue

                msg = json.loads(raw)
                # Phoenix message format: [join_ref, ref, topic, event, payload]
                if not isinstance(msg, list) or len(msg) < 5:
                    continue

                _, _, topic, event, payload = msg

                if event == "phx_reply":
                    # Join reply or heartbeat reply
                    status = payload.get("status", "")
                    if status == "ok":
                        continue
                    elif status == "error":
                        self.logger.error(f"[Realtime] Erro no canal: {payload}")
                        break

                elif event == "broadcast" and topic == self.topic:
                    # Command received!
                    self._handle_broadcast(payload)

                elif event == "phx_error":
                    self.logger.error(f"[Realtime] Canal com erro: {payload}")
                    break

                elif event == "phx_close":
                    self.logger.info("[Realtime] Canal fechado pelo servidor")
                    break

            except websocket.WebSocketTimeoutException:
                # Timeout is expected, just continue (heartbeat keeps connection alive)
                continue
            except websocket.WebSocketConnectionClosedException:
                self.logger.warning("[Realtime] Conexão WebSocket fechada")
                break
            except Exception as e:
                self.logger.error(f"[Realtime] Erro ao processar mensagem: {e}")
                break

        # Cleanup
        self._ws = None
        try:
            ws.close()
        except Exception:
            pass

    def _start_phoenix_heartbeat(self, ws):
        """Send Phoenix heartbeat every 30s to keep connection alive."""
        def _heartbeat():
            while not self._stop_event.is_set() and self._ws == ws:
                try:
                    self._send(ws, "phoenix", "heartbeat", {})
                except Exception:
                    break
                # Sleep in small increments to respond to stop quickly
                for _ in range(30):
                    if self._stop_event.is_set():
                        return
                    time.sleep(1)

        t = threading.Thread(target=_heartbeat, daemon=True, name="realtime-hb")
        t.start()

    def _handle_broadcast(self, payload):
        """Handle a broadcast message containing a command."""
        try:
            event_type = payload.get("event", "")
            data = payload.get("payload", {})

            if event_type != "command":
                return

            cmd = {
                "id": data.get("id"),
                "command": data.get("command"),
                "timeout_seconds": data.get("timeout_seconds", 60),
            }

            if not cmd["id"] or not cmd["command"]:
                self.logger.warning("[Realtime] Broadcast recebido sem id ou command")
                return

            self.logger.info(
                f"[Realtime] Comando recebido em tempo real: "
                f"{cmd['command'][:80]}... (id={cmd['id'][:8]}...)"
            )

            # Execute using the shared handler
            self.handler._execute_command(cmd)

        except Exception as e:
            self.logger.error(f"[Realtime] Erro ao processar broadcast: {e}")
