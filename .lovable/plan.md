

# Auto-detectar e enviar capabilities no heartbeat (a cada 12h)

## Resumo

O heartbeat atual envia apenas `status` e `agent_version`. As capabilities (ferramentas instaladas no servidor) nunca são reportadas, resultando em cards vazios na UI.

A solução adiciona detecção automática de capabilities no agente Python, enviadas a cada 12 horas (não em todo heartbeat), e o backend salva essas informações na coluna `capabilities` da tabela `agents`.

## Arquitetura

```text
Agent (Python)                          Edge Function (agent-heartbeat)
┌─────────────────────┐                ┌──────────────────────────┐
│ heartbeat.send()    │                │                          │
│   ├─ status         │───POST────────▶│  body.capabilities?      │
│   ├─ agent_version  │                │    → UPDATE agents SET   │
│   └─ capabilities?  │                │      capabilities = [...] │
│       (a cada 12h)  │                │                          │
└─────────────────────┘                └──────────────────────────┘

Detecção (shutil.which / subprocess):
  nmap, amass, pwsh, ssh, snmp, python3, openssl, masscan, curl, httpx
```

## Mudanças

### 1. Python Agent — `python-agent/agent/heartbeat.py`

Adicionar método `_detect_capabilities()` que verifica quais ferramentas estão instaladas usando `shutil.which()`. Adicionar lógica de throttling: só incluir capabilities no payload se a última vez que foram enviadas foi há mais de 12h (usar `state.data["last_capabilities_sent"]`).

```python
import shutil
import time

CAPABILITIES_INTERVAL = 43200  # 12 horas em segundos

CAPABILITY_CHECKS = [
    ("nmap", "nmap"),
    ("amass", "amass"),  
    ("powershell", "pwsh"),
    ("ssh", "ssh"),
    ("snmp", "snmpwalk"),
    ("python3", "python3"),
    ("openssl", "openssl"),
    ("masscan", "masscan"),
    ("curl", "curl"),
    ("httpx", "httpx"),
    ("dns_query", "dig"),
]
```

No método `send()`, verificar se `time.time() - last_capabilities_sent > 43200` e, se sim, incluir `capabilities` no payload e atualizar o timestamp no state.

### 2. Edge Function — `supabase/functions/agent-heartbeat/index.ts`

- Adicionar `capabilities?: string[]` à interface `HeartbeatRequest`
- Após verificação do token, se `body.capabilities` existir e for um array, salvar na tabela `agents`:

```typescript
if (Array.isArray(body.capabilities)) {
  await supabase
    .from('agents')
    .update({ capabilities: body.capabilities })
    .eq('id', agentId);
}
```

### 3. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `python-agent/agent/heartbeat.py` | Adicionar `_detect_capabilities()` + throttling 12h + incluir no payload |
| `supabase/functions/agent-heartbeat/index.ts` | Aceitar e persistir `capabilities` do payload |

### 4. Deploy

A Edge Function será deployada automaticamente. O agente precisará de update (v1.3.3+) para começar a enviar capabilities.

### Capabilities detectadas

| Capability | Binário verificado | Uso |
|---|---|---|
| nmap | `nmap` | Scan de portas |
| amass | `amass` | Enumeração de subdomínios |
| powershell | `pwsh` | Análises M365 |
| ssh | `ssh` | Conexão a firewalls |
| snmp | `snmpwalk` | Coleta SNMP |
| python3 | `python3` | Runtime do agent |
| openssl | `openssl` | Certificados |
| masscan | `masscan` | Scan massivo |
| curl | `curl` | Requisições HTTP |
| httpx | `httpx` | Fingerprinting web |
| dns_query | `dig` | Consultas DNS |

