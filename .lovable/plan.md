

# Heartbeat Worker Independente

## Problema

O loop atual e sequencial: heartbeat, executa tarefas, dorme. Durante scans longos (nmap full-range pode levar 10-30 min), o agent nao envia heartbeat e o token pode expirar. O backend perde visibilidade do agent e pode marca-lo como offline.

## Solucao

Criar um **HeartbeatWorker** em thread separada que roda em paralelo com a execucao de tarefas.

```text
Antes:
  [heartbeat] -> [tarefa 10min] -> [sleep] -> [heartbeat] -> ...
  (backend acha que agent morreu durante os 10min)

Depois:
  Thread Principal:  [busca tarefas] -> [executa tarefa 10min] -> [busca tarefas] -> ...
  Thread Heartbeat:  [heartbeat] -> [sleep 120s] -> [heartbeat] -> [sleep 120s] -> ...
  (heartbeat nunca para, token sempre valido)
```

## Mudancas

### 1. Novo arquivo: `python-agent/agent/heartbeat_worker.py`

Thread daemon dedicada que:
- Envia heartbeat no intervalo configurado pelo backend (default 120s)
- Renova token proativamente quando esta proximo de expirar (usa `auth.is_access_token_valid()`)
- Usa `threading.Event` para permitir shutdown gracioso
- Usa `threading.Lock` para sincronizar acesso ao state/token com a thread principal
- Detecta `AgentStopped` (BLOCKED/REVOKED) e sinaliza para a thread principal parar

### 2. Modificar: `python-agent/agent/auth.py`

- Adicionar um `threading.Lock` ao `AuthManager` para proteger `refresh_tokens()` contra chamadas simultaneas da thread de heartbeat e da thread de tarefas
- Garantir que apenas um refresh acontece por vez (evita race condition)

### 3. Modificar: `python-agent/agent/state.py`

- Adicionar um `threading.Lock` ao `AgentState` para proteger `save()` e `load()` contra acesso concorrente

### 4. Modificar: `python-agent/main.py`

- Criar o `HeartbeatWorker` e inicia-lo como thread daemon antes do loop de tarefas
- Simplificar o `agent_loop`: remover logica de heartbeat (agora e responsabilidade do worker)
- O loop principal passa a focar apenas em: buscar tarefas, executar, dormir
- Tratar sinal de parada vindo do heartbeat worker (AgentStopped)

### 5. Modificar: `python-agent/agent/api_client.py`

- Adicionar lock no `_headers()` para leitura thread-safe do token

## Detalhes tecnicos

### Thread Safety

Os recursos compartilhados entre as threads sao:
- `state.data` (tokens, agent_id) — protegido por lock no `AgentState`
- `auth.refresh_tokens()` — protegido por lock no `AuthManager` para evitar refresh duplicado
- `api._headers()` — le token de `state.data`, protegido pelo lock do state

### HeartbeatWorker (pseudo-codigo)

```text
class HeartbeatWorker(Thread):
    daemon = True

    loop:
        1. Se token proximo de expirar -> auth.refresh_tokens()
        2. Envia heartbeat via api.post("/agent-heartbeat")
        3. Processa resposta (update, check_components, certificate)
        4. Se BLOCKED/REVOKED -> sinaliza stop_event
        5. Dorme pelo intervalo retornado pelo backend
```

### Shutdown gracioso

- HeartbeatWorker usa `threading.Event` como stop signal
- A thread principal verifica `stop_event.is_set()` entre tarefas
- Como e daemon thread, se a main thread morrer, ela morre junto

### O que NAO muda

- Nenhum executor e modificado
- A logica de execucao de tarefas em `tasks.py` permanece igual
- O `AgentScheduler` continua gerenciando o loop principal (agora so de tarefas)
- O progressive streaming continua funcionando normalmente
- O `AutoUpdater` continua no loop principal

## Riscos e mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Race condition no token refresh | Lock no AuthManager — apenas um refresh por vez |
| Heartbeat e tarefa escrevendo state simultaneamente | Lock no AgentState.save() |
| Token expira entre leitura e uso no POST | APIClient ja tem retry automatico com TOKEN_EXPIRED |
| HeartbeatWorker crasha | Como daemon thread, o agent continua rodando (fallback ao comportamento atual) |

