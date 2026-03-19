

## Fix: RealtimeShell não conecta e Supervisor reinicia em loop

### Diagnóstico

Os logs provam que:
- `realtime_shell.start()` é chamado (log "Heartbeat solicitou início do Realtime Shell")
- **Nenhum log subsequente** do WebSocket aparece (deveria ter "Conectando ao Supabase Realtime...")
- O Supervisor reinicia múltiplas vezes em poucos segundos

Causas prováveis:
1. O thread daemon do RealtimeShell crasha silenciosamente (ex: `websocket-client` não instalado, erro de importação, URL malformada)
2. O Supervisor pode estar sendo reiniciado pelo systemd por outra razão (ex: múltiplas instâncias competindo)
3. A cada restart, `realtime_active` reseta para `False` e um novo shell é criado (sem efeito)

### Alterações

#### 1. `python-agent/supervisor/realtime_shell.py` — Logging defensivo no thread

Adicionar log no início de `_run()` para confirmar que o thread está executando, e try/except geral para capturar erros fatais (ex: import faltando, URL inválida):

```python
def _run(self):
    self.logger.info("[RealtimeShell] Thread iniciada, preparando conexão...")
    while not self._stop_event.is_set():
        try:
            self._connect_and_listen()
        except Exception as e:
            if self._stop_event.is_set():
                break
            self.logger.error(f"[RealtimeShell] Erro na conexão WebSocket: {e}", exc_info=True)
            self._stop_event.wait(timeout=5)
    self.logger.info("[RealtimeShell] Thread encerrada.")
```

Adicionar log na construção da URL:

```python
def _connect_and_listen(self):
    url = self._build_ws_url()
    self.logger.info(f"[RealtimeShell] Conectando: {url[:80]}...")
```

#### 2. `python-agent/supervisor/main.py` — Proteção ao iniciar shell

Envolver `realtime_shell.start()` em try/except para que uma falha no shell não mate o Supervisor:

```python
if should_realtime and not realtime_active:
    if SUPABASE_URL and SUPABASE_ANON_KEY:
        logger.info("[Supervisor] Heartbeat solicitou início do Realtime Shell (WebSocket).")
        try:
            realtime_shell = RealtimeShell(
                supabase_url=SUPABASE_URL,
                anon_key=SUPABASE_ANON_KEY,
                agent_id=str(state.get("agent_id", "")),
                logger=logger,
            )
            realtime_shell.start()
            realtime_active = True
            logger.info("[Supervisor] RealtimeShell thread iniciada com sucesso.")
        except Exception as e:
            logger.error(f"[Supervisor] Falha ao iniciar RealtimeShell: {e}", exc_info=True)
            realtime_shell = None
            realtime_active = False
```

#### 3. `python-agent/supervisor/realtime_shell.py` — Guard contra SUPABASE_URL vazio

Validar URL e key no construtor:

```python
def __init__(self, supabase_url, anon_key, agent_id, logger):
    if not supabase_url or not anon_key:
        raise ValueError("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios")
    ...
```

### Sobre HTTPS

Sim, a conexão é segura. O `_build_ws_url` converte `https://` para `wss://`, que usa TLS (mesma criptografia do HTTPS). Os dados trafegam criptografados entre o Agent e o Supabase Realtime.

### Resultado esperado

Após deploy, os logs do Supervisor mostrarão exatamente onde o fluxo falha:
- Se o thread inicia: `[RealtimeShell] Thread iniciada...`
- Se a URL está correta: `[RealtimeShell] Conectando: wss://...`
- Se há erro de dependência ou conexão: stack trace completo no log
- Se o Supervisor não crashar mais, o shell terá tempo para conectar

