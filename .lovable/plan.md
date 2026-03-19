

## Fix: `AgentState` não tem método `.get()`

### Problema
O erro é direto: `state.get("agent_id", "")` falha porque `AgentState` não expõe `.get()`. Os dados ficam em `state.data` (um dict).

### Correção

**Arquivo**: `python-agent/supervisor/main.py`, linha 185

Trocar:
```python
agent_id=str(state.get("agent_id", "")),
```
Por:
```python
agent_id=str(state.data.get("agent_id", "")),
```

### Resultado
O `RealtimeShell` será instanciado corretamente com o `agent_id` do estado, permitindo a conexão WebSocket prosseguir.

