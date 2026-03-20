"""
Realtime Listener — Lightweight permanent WebSocket listener for wake events.

Connects to the Supabase Realtime broadcast channel `shell:{agent_id}` and
listens for a `wake` event from the UI. When received, sets a threading.Event
so the Supervisor main loop can start RealtimeShell immediately (no heartbeat wait).

This is a daemon thread that auto-reconnects on failure.
"""

import json
import threading
import time

import websocket


class RealtimeWakeListener:
    """Listens on `shell:{agent_id}` for a `wake` broadcast event."""

    def __init__(self, supabase_url: str, anon_key: str, agent_id: str, logger):
        if not supabase_url or not anon_key:
            raise ValueError("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios")
        self.supabase_url = supabase_url.rstrip("/")
        self.anon_key = anon_key
        self.agent_id = agent_id
        self.logger = logger

        self._ws = None
        self._thread = None
        self._stop_event = threading.Event()
        self._joined = False

        # Flag consumed by the main loop
        self.wake_event = threading.Event()

    def start(self):
        """Start the listener in a daemon thread."""
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run, daemon=True, name="realtime-wake-listener"
        )
        self._thread.start()
        self.logger.info("[WakeListener] Thread iniciada — escutando canal wake.")

    def stop(self):
        """Stop the listener."""
        self._stop_event.set()
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
        self.logger.info("[WakeListener] Parado.")

    @property
    def is_running(self):
        return self._thread is not None and self._thread.is_alive()

    def _build_ws_url(self) -> str:
        base = self.supabase_url.replace("https://", "wss://").replace("http://", "ws://")
        return f"{base}/realtime/v1/websocket?apikey={self.anon_key}&vsn=1.0.0"

    def _run(self):
        while not self._stop_event.is_set():
            try:
                self._connect_and_listen()
            except Exception as e:
                if self._stop_event.is_set():
                    break
                self.logger.warning(f"[WakeListener] Erro na conexão: {e}")
                self._stop_event.wait(timeout=10)
        self.logger.info("[WakeListener] Thread encerrada.")

    def _connect_and_listen(self):
        url = self._build_ws_url()
        self.logger.info(f"[WakeListener] Conectando: {url[:80]}...")

        self._ws = websocket.WebSocketApp(
            url,
            on_open=self._on_open,
            on_message=self._on_message,
            on_error=self._on_error,
            on_close=self._on_close,
        )

        # Phoenix heartbeat thread
        hb_thread = threading.Thread(
            target=self._phoenix_heartbeat, daemon=True, name="wake-phoenix-hb"
        )
        hb_thread.start()

        self._ws.run_forever(ping_interval=30, ping_timeout=10)

    def _on_open(self, ws):
        self.logger.info("[WakeListener] WebSocket conectado, joining channel...")
        self._join_channel()

    def _join_channel(self):
        topic = f"realtime:shell:{self.agent_id}"
        join_msg = json.dumps({
            "topic": topic,
            "event": "phx_join",
            "payload": {
                "config": {
                    "broadcast": {"self": False},
                    "presence": {"key": ""},
                }
            },
            "ref": "wake-join-ref",
        })
        try:
            self._ws.send(join_msg)
        except Exception as e:
            self.logger.error(f"[WakeListener] Erro ao enviar join: {e}")

    def _on_message(self, ws, message):
        try:
            msg = json.loads(message)
        except Exception:
            return

        event = msg.get("event")
        payload = msg.get("payload", {})
        topic = msg.get("topic", "")

        # Join reply
        if event == "phx_reply" and msg.get("ref") == "wake-join-ref":
            status = payload.get("status")
            if status == "ok":
                self._joined = True
                self.logger.info("[WakeListener] ✅ Canal joined — escutando evento wake.")
            else:
                self.logger.error(f"[WakeListener] ❌ Falha no join: {payload}")
            return

        # Broadcast event
        if event == "broadcast" and topic == f"realtime:shell:{self.agent_id}":
            inner_event = payload.get("event")
            if inner_event == "wake":
                self.logger.info("[WakeListener] 🔔 Evento WAKE recebido da UI!")
                self.wake_event.set()

    def _on_error(self, ws, error):
        if not self._stop_event.is_set():
            self.logger.warning(f"[WakeListener] WebSocket erro: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        self._joined = False
        if not self._stop_event.is_set():
            self.logger.info(f"[WakeListener] WebSocket fechado (code={close_status_code})")

    def _phoenix_heartbeat(self):
        """Send Phoenix heartbeat every 30s to keep connection alive."""
        while not self._stop_event.is_set():
            self._stop_event.wait(timeout=30)
            if self._stop_event.is_set():
                break
            try:
                if self._ws and self._joined:
                    hb = json.dumps({
                        "topic": "phoenix",
                        "event": "heartbeat",
                        "payload": {},
                        "ref": "wake-hb",
                    })
                    self._ws.send(hb)
            except Exception:
                pass
