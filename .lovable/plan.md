

# Terminal Remoto em Tempo Real via Supabase Realtime

## Problema

Atualmente o agent só detecta comandos pendentes durante o heartbeat (a cada ~120s). Isso torna a experiência do terminal remoto lenta e impraticável para tarefas urgentes como `systemctl stop iscope-agent`.

## Solução: Supabase Realtime Channel

O Supabase oferece **Realtime Channels** via WebSocket. O agent pode se inscrever em um canal dedicado e receber comandos instantaneamente, sem depender do heartbeat.

```text
GUI (super_admin)              Supabase Realtime              Agent (Python)
┌──────────────────┐    ┌───────────────────────────┐    ┌──────────────────────┐
│ Terminal UI       │    │                           │    │                      │
│ $ systemctl stop  │───▶│ INSERT agent_commands     │    │ WebSocket listener   │
│                   │    │                           │    │   (supabase-py)      │
│                   │    │ postgres_changes event ───│───▶│   → subprocess.run() │
│ stdout/stderr ◀───│────│ UPDATE agent_commands     │◀───│   → UPDATE result    │
└──────────────────┘    └───────────────────────────┘    └──────────────────────┘

Latência: ~1-2 segundos (vs 0-120s atual)
```

### Como funciona

1. O Supervisor inicia uma **thread de Realtime** que abre uma conexão WebSocket persistente com o Supabase
2. Essa thread escuta eventos `INSERT` na tabela `agent_commands` filtrados pelo `agent_id` do agent
3. Quando um comando chega, a thread executa imediatamente via `subprocess.run()` e faz UPDATE do resultado
4. Se o WebSocket cair, a thread reconecta automaticamente com backoff exponencial
5. O heartbeat continua como **fallback** — se houver comandos pendentes não processados pelo Realtime, o heartbeat os captura

### Vantagens

- Execução quase instantânea (~1-2s)
- Sem polling desnecessário
- Fallback via heartbeat garante que nenhum comando se perde
- A infraestrutura Realtime já existe no Supabase, sem custo adicional

## Mudanças

### 1. Dependência Python: `supabase` ou `realtime-py`

Adicionar `realtime-py` (cliente Realtime do Supabase para Python) ao `requirements.txt`. Este pacote usa `websockets` internamente.

```
realtime-py>=2.0.0
websockets>=12.0
```

### 2. Novo módulo: `python-agent/agent/realtime_commands.py`

Thread dedicada que:
- Conecta ao Supabase Realtime usando a URL do projeto e a `anon_key` (ou service_role key)
- Inscreve-se no canal `postgres_changes` para `INSERT` em `agent_commands` com filtro `agent_id=eq.<agent_id>`
- Ao receber evento, executa o comando via `subprocess.run(shell=True, timeout=N)`
- Atualiza o resultado diretamente via REST API (POST `/agent-commands`)
- Implementa reconexão automática com backoff exponencial (2s, 4s, 8s, max 60s)

```python
# Pseudocódigo simplificado
class RealtimeCommandListener:
    def __init__(self, agent_id, supabase_url, supabase_key, api, logger):
        self.agent_id = agent_id
        self.channel = None
        self._thread = None
        
    def start(self):
        """Inicia thread de escuta Realtime."""
        self._thread = Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
    
    def _listen_loop(self):
        """Loop com reconexão automática."""
        while True:
            try:
                client = RealtimeClient(url, key)
                channel = client.channel("agent-commands")
                channel.on_postgres_changes(
                    event="INSERT",
                    schema="public", 
                    table="agent_commands",
                    filter=f"agent_id=eq.{self.agent_id}",
                    callback=self._on_command
                )
                channel.subscribe()
                client.listen()  # blocking
            except Exception:
                time.sleep(backoff)
                
    def _on_command(self, payload):
        """Executa comando recebido em tempo real."""
        # Reutiliza RemoteCommandHandler._execute_command()
```

### 3. Editar: `python-agent/supervisor/main.py`

Iniciar o `RealtimeCommandListener` como daemon thread logo após o boot do worker:

```python
from agent.realtime_commands import RealtimeCommandListener

realtime = RealtimeCommandListener(
    agent_id=state.data["agent_id"],
    supabase_url=SUPABASE_URL,
    supabase_key=SUPABASE_KEY,
    api=api,
    logger=logger,
)
realtime.start()
```

### 4. Editar: `python-agent/supervisor/config.py`

Adicionar variáveis para Realtime:

```python
SUPABASE_URL = os.getenv("SUPABASE_URL")       # ex: https://akbosdbyheezghieiefz.supabase.co
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
```

Essas variáveis já existem no `.env` do projeto e precisam ser adicionadas ao `agent.env` de cada servidor.

### 5. Editar: `python-agent/agent/remote_commands.py`

Extrair a lógica de execução (`_execute_command` + `_report_result`) para ser reutilizável tanto pelo handler de heartbeat quanto pelo listener Realtime.

### 6. Frontend: Sem mudanças

O `RemoteTerminal.tsx` já faz polling a cada 2s e exibe o resultado. Com Realtime, o resultado aparece quase instantaneamente sem necessidade de alterar o frontend. Opcionalmente, podemos trocar o polling por Supabase Realtime no frontend também (subscribe a changes na tabela `agent_commands`), mas isso é uma melhoria futura.

### 7. Manter heartbeat como fallback

O código existente que verifica `has_pending_commands` no heartbeat continua funcionando. Se o WebSocket estiver desconectado temporariamente, o heartbeat captura comandos perdidos. Isso garante resiliência.

## Arquivos afetados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `python-agent/requirements.txt` | Edição | Adicionar `realtime-py`, `websockets` |
| `python-agent/agent/realtime_commands.py` | Novo | Thread de escuta Realtime |
| `python-agent/agent/remote_commands.py` | Edição | Extrair lógica de execução reutilizável |
| `python-agent/supervisor/config.py` | Edição | Adicionar `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `python-agent/supervisor/main.py` | Edição | Iniciar listener Realtime |

## Configuração necessária nos servidores

Adicionar ao `/etc/iscope/agent.env`:
```
SUPABASE_URL=https://akbosdbyheezghieiefz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Segurança

- O canal Realtime usa a `anon_key` mas filtra apenas pelos eventos do `agent_id` específico
- A RLS na tabela `agent_commands` garante que apenas `super_admin` ou `service_role` podem inserir/ver comandos
- O agent só recebe notificações de INSERT — ele não tem acesso de escrita via Realtime, apenas via REST API autenticada com JWT

