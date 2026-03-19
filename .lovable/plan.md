

## Módulo de Monitoramento — python-agent/monitor/

Novo módulo independente que coleta métricas de performance do servidor e as envia ao backend via heartbeat ou endpoint dedicado. Roda como processo/thread separado, gerenciado pelo Supervisor (assim como o Worker).

### Arquitetura

```text
┌──────────────────────────────────────────────┐
│              Supervisor (main.py)             │
│                                               │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐ │
│  │ Worker   │  │ HB Loop │  │ MonitorMgr   │ │
│  │ Manager  │  │         │  │ (novo)       │ │
│  └─────────┘  └─────────┘  └──────────────┘ │
│                                   │           │
│                          ┌────────▼────────┐ │
│                          │ MonitorWorker   │ │
│                          │ (daemon thread) │ │
│                          └─────────────────┘ │
└──────────────────────────────────────────────┘
```

### Métricas coletadas (via `os`, `subprocess`, `/proc`)

Sem dependência de `psutil` — leitura direta de `/proc` (Linux) para manter o agent leve.

| Categoria | Métrica | Tipo |
|---|---|---|
| **CPU** | `cpu_percent` (%) | float |
| **CPU** | `cpu_count` (cores) | int |
| **CPU** | `load_avg_1m / 5m / 15m` | float |
| **RAM** | `ram_total_mb` | int |
| **RAM** | `ram_used_mb` | int |
| **RAM** | `ram_percent` (%) | float |
| **Disco** | `disk_total_gb` | float |
| **Disco** | `disk_used_gb` | float |
| **Disco** | `disk_percent` (%) | float |
| **Disco** | `disk_path` (mount point monitorado) | string |
| **Rede** | `net_bytes_sent` (delta/s) | int |
| **Rede** | `net_bytes_recv` (delta/s) | int |
| **Sistema** | `uptime_seconds` | int |
| **Sistema** | `hostname` | string |
| **Sistema** | `os_info` (distro + kernel) | string |
| **Processos** | `process_count` | int |

### Arquivos novos

**1. `python-agent/monitor/__init__.py`** — Pacote vazio.

**2. `python-agent/monitor/collector.py`** — Classe `MetricsCollector` com métodos estáticos que leem `/proc/stat`, `/proc/meminfo`, `/proc/uptime`, `/proc/net/dev` e `os.statvfs()`. Sem dependências externas. Retorna um dict com todas as métricas acima.

**3. `python-agent/monitor/worker.py`** — Classe `MonitorWorker(threading.Thread)` (daemon thread):
- Coleta métricas a cada N segundos (default 60s, configurável via env `MONITOR_INTERVAL`)
- Envia para o backend via `api.post("/agent-monitor", json=payload)`
- Grava snapshot local em `/var/lib/iscope-agent/monitor.json` (para debug e health check)
- Tratamento de erros e retry com backoff

**4. `python-agent/monitor/version.py`** — Versão independente `__version__ = "1.0.0"` para permitir updates separados.

### Arquivos modificados

**5. `python-agent/supervisor/config.py`** — Adicionar:
- `MONITOR_INTERVAL = int(os.getenv("MONITOR_INTERVAL", "60"))`

**6. `python-agent/supervisor/main.py`** — Integrar o MonitorWorker:
- Importar `MonitorWorker` do `monitor.worker`
- Instanciar e iniciar a thread após o Worker start
- Parar a thread no shutdown
- O Supervisor já gerencia updates do Worker; o monitor será atualizado junto (mesmo pacote)

### Endpoint backend (Edge Function)

**7. `supabase/functions/agent-monitor/index.ts`** — Edge function que:
- Recebe `POST` com métricas do agent
- Valida JWT do agent
- Salva na tabela `agent_metrics`

### Tabela Supabase

**8. Migration** — Criar tabela `agent_metrics`:
```sql
CREATE TABLE public.agent_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  cpu_percent numeric(5,2),
  cpu_count integer,
  load_avg_1m numeric(6,2),
  load_avg_5m numeric(6,2),
  load_avg_15m numeric(6,2),
  ram_total_mb integer,
  ram_used_mb integer,
  ram_percent numeric(5,2),
  disk_total_gb numeric(8,2),
  disk_used_gb numeric(8,2),
  disk_percent numeric(5,2),
  disk_path text DEFAULT '/',
  net_bytes_sent bigint,
  net_bytes_recv bigint,
  uptime_seconds bigint,
  hostname text,
  os_info text,
  process_count integer,
  collected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index para queries por agent + tempo
CREATE INDEX idx_agent_metrics_agent_time ON public.agent_metrics(agent_id, collected_at DESC);

-- Cleanup: manter apenas últimas 24h (ou configurável)
ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;
```

### Resumo da execução

1. Criar pacote `monitor/` com collector e worker
2. Collector lê `/proc` diretamente (zero dependências extras)
3. Worker roda como daemon thread no Supervisor
4. Métricas enviadas a cada 60s ao backend
5. Backend salva em `agent_metrics` para consulta futura
6. Atualizável pelo Supervisor junto com o Worker (mesmo diretório)

