

## Plano: Intervalo de coleta por step no blueprint

### Conceito

Adicionar um campo `interval_seconds` a cada step do blueprint. O monitor rastreia o timestamp da última coleta de cada step e só executa quando o intervalo venceu. O loop principal roda no menor intervalo (ex: 30s para rede), mas steps lentos (ex: system) rodam a cada 3600s.

### Exemplo de blueprint atualizado

```json
{
  "steps": [
    {"id": "cpu",  "type": "proc_read", "params": {"parser": "cpu"},            "interval_seconds": 60},
    {"id": "mem",  "type": "proc_read", "params": {"parser": "memory"},         "interval_seconds": 60},
    {"id": "disk", "type": "statvfs",   "params": {"scan_mounts": true},        "interval_seconds": 120},
    {"id": "net",  "type": "proc_read", "params": {"parser": "net_interfaces"}, "interval_seconds": 30},
    {"id": "sys",  "type": "proc_read", "params": {"parser": "system"},         "interval_seconds": 3600}
  ]
}
```

### Mudanças

**1. Migration SQL — Atualizar blueprint existente**

UPDATE do `collection_steps` do blueprint `linux_server` adicionando `interval_seconds` a cada step.

**2. `python-agent/monitor/main.py`**

- Calcular `base_interval` como o menor `interval_seconds` entre todos os steps (mínimo 10s).
- Manter um dict `last_collected_at: Dict[str, float]` (step_id → monotonic timestamp).
- Em `_collect_from_blueprint`: verificar se `now - last_collected_at[step_id] >= step.interval_seconds` antes de executar. Se não venceu, pular. Se venceu, executar e atualizar timestamp.
- Enviar apenas os campos que foram coletados naquele ciclo (merge parcial).
- Manter snapshot local com dados completos (merge incremental: novos dados sobrescrevem, dados antigos permanecem).

**3. Edge Function `agent-monitor`**

Sem mudanças — já aceita campos parciais (todos os campos usam `?? null`).

**4. Frontend**

Sem mudanças — já exibe o que vier de cada linha de `agent_metrics`.

### Lógica do loop

```text
base_interval = min(step.interval_seconds for step in steps)  # ex: 30s

loop:
  now = monotonic()
  metrics = {}
  for step in steps:
    if now - last_collected[step.id] >= step.interval_seconds:
      result = executor.execute(step.params)
      metrics.update(result)
      last_collected[step.id] = now
  
  if metrics:  # só envia se coletou algo
    send(metrics)
  
  sleep(base_interval)
```

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | UPDATE blueprint com `interval_seconds` por step |
| `python-agent/monitor/main.py` | Loop com intervalo por step, base_interval dinâmico |
| `python-agent/monitor/version.py` | 1.1.3 → 1.1.4 |

