

## Plano: Monitor Template-Driven (sem módulo Endpoint)

### Conceito

Transformar o Monitor de um coletor com lógica hardcoded em um coletor genérico que busca um blueprint "linux_server" do banco de dados e executa steps usando executors internos ao módulo `monitor/`. A mesma arquitetura do Worker, mas contida no pacote monitor.

### Arquitetura

```text
Supabase DB
  device_types: code="linux_server", category="server"
  device_blueprints: collection_steps →
    steps:
      - {id: "cpu",  type: "proc_read", params: {parser: "cpu"}}
      - {id: "mem",  type: "proc_read", params: {parser: "memory"}}
      - {id: "disk", type: "statvfs",   params: {scan_mounts: true}}
      - {id: "net",  type: "proc_read", params: {parser: "net_interfaces"}}
      - {id: "sys",  type: "proc_read", params: {parser: "system"}}
        │
        │ fetch blueprint on boot (cache local)
        ▼
Monitor (coletor burro)
  monitor/executors/proc_read.py  ← parsers: cpu, memory, net, uptime, etc.
  monitor/executors/statvfs.py    ← disco via /proc/mounts + os.statvfs
  monitor/main.py                 ← itera steps, chama executor, agrega, envia
```

### Etapas

**Etapa 1 — Executors em `monitor/executors/`**

Criar diretório `python-agent/monitor/executors/` com:

| Arquivo | Função |
|---------|--------|
| `__init__.py` | Registry de executors por type |
| `base.py` | Classe base `MonitorExecutor` (igual ao padrão do Worker) |
| `proc_read.py` | Lê `/proc/*` e aplica parser nomeado (`cpu`, `memory`, `net_interfaces`, `system`) — extrai a lógica atual do `collector.py` |
| `statvfs.py` | Coleta disco via `/proc/mounts` + `os.statvfs()` — extrai lógica do `collector.py` |

A lógica é exatamente a mesma que já existe no `collector.py`, apenas reorganizada em executors parametrizáveis. Os executors mantêm estado (deltas de CPU/rede) internamente.

**Etapa 2 — Template "linux_server" no banco**

Migration SQL:
- Adicionar `'server'` ao enum `device_category` (se não existir, já tem `'server'` no enum original)
- Inserir `device_type` com `code='linux_server'`, `vendor='Linux'`, `category='server'`
- Inserir `device_blueprint` com `executor_type='monitor'` (ou `'agent'`) contendo os 5 steps acima

**Etapa 3 — Refatorar `monitor/main.py`**

- No boot: buscar blueprint ativo de `linux_server` via Supabase (usando `api.get` ou query direto)
- Cache local do blueprint em `/var/lib/iscope-agent/monitor_blueprint.json` (refresh a cada 30 min)
- Loop de coleta: iterar `steps` do blueprint, instanciar executor pelo `type`, executar, agregar resultados
- Fallback: se blueprint indisponível, usar `collector.py` atual (backward compat)
- Bump version para 1.1.3

**Etapa 4 — Manter `collector.py` como fallback**

O `collector.py` atual continua intacto como fallback. Se o Monitor não conseguir buscar o blueprint (primeiro boot, sem internet, etc.), usa coleta hardcoded.

### Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `python-agent/monitor/executors/__init__.py` | Criar — registry |
| `python-agent/monitor/executors/base.py` | Criar — classe base |
| `python-agent/monitor/executors/proc_read.py` | Criar — executor /proc com parsers |
| `python-agent/monitor/executors/statvfs.py` | Criar — executor disco |
| `python-agent/monitor/main.py` | Alterar — buscar blueprint, iterar steps |
| `python-agent/monitor/collector.py` | Manter inalterado (fallback) |
| `python-agent/monitor/version.py` | 1.1.2 → 1.1.3 |
| Migration SQL | device_type linux_server + blueprint com steps |

### O que NÃO muda

- Edge Function `agent-monitor` — mesmo payload
- Tabela `agent_metrics` — mesma estrutura
- Frontend — mesmos gráficos
- Módulo Endpoint — fica para o futuro

