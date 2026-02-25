## Arquitetura de Cross-Update: Supervisor ↔ Agent

Faz total sentido. O problema fundamental e que o processo que tenta se atualizar mantém módulos antigos em memória. Com cross-update, cada processo atualiza o OUTRO, eliminando o problema por definição.

```text
ANTES (problemático):
┌─────────────────────────────────────┐
│ Supervisor (PID 100, v1.0.0)       │
│   ├── Heartbeat → update=true      │
│   ├── Download pacote ÚNICO        │
│   ├── Substitui TUDO (agent/ + supervisor/)
│   ├── Reinicia Worker              │
│   └── Supervisor continua com      │
│       módulos ANTIGOS em memória ✗ │
└─────────────────────────────────────┘

DEPOIS (cross-update):
┌──────────────────────┐     ┌──────────────────────┐
│ Supervisor v1.0.0    │     │ Worker (Agent) v1.3.4│
│                      │     │                      │
│ Detecta: agent       │     │ Detecta: supervisor  │
│ update available     │     │ update available      │
│   → Para Worker      │     │   → Substitui        │
│   → Substitui agent/ │     │     supervisor/       │
│   → Inicia Worker    │     │   → Sinaliza restart  │
│                      │     │                      │
│ Detecta: restart     │     │                      │
│ flag → sys.exit(0)   │     │                      │
│ systemd reinicia ✓   │     │                      │
└──────────────────────┘     └──────────────────────┘
```

### Mudanças Necessarias

#### 1. Backend — Database (system_settings)

Adicionar novas chaves ao `system_settings`:


| Chave                        | Valor Inicial | Descrição                         |
| ---------------------------- | ------------- | --------------------------------- |
| `supervisor_latest_version`  | `"1.0.0"`     | Versão mais recente do Supervisor |
| `supervisor_update_checksum` | `""`          | SHA256 do pacote do Supervisor    |


#### 2. Backend — Edge Function `agent-heartbeat`


| Mudança                                                           | Detalhe                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Aceitar `supervisor_version` no payload                           | Novo campo opcional no `HeartbeatRequest`                                                      |
| Buscar `supervisor_latest_version` no system_settings             | Junto com `agent_latest_version`                                                               |
| Retornar `supervisor_update_available` + `supervisor_update_info` | Nova seção no response, com `download_url` apontando para `iscope-supervisor-{version}.tar.gz` |
| Atualizar coluna `supervisor_version` no agents                   | Novo campo para rastrear no dashboard                                                          |


#### 3. Database — Tabela `agents`


| Mudança                                | Detalhe                                            |
| -------------------------------------- | -------------------------------------------------- |
| Nova coluna: `supervisor_version text` | Para rastrear a versão do Supervisor de cada agent |


#### 4. Supervisor (`supervisor/main.py` + `supervisor/updater.py`)

`**supervisor/main.py`:**

- Enviar `supervisor_version` no heartbeat payload
- Quando receber `supervisor_update_available`, escrever info em `/var/lib/iscope-agent/pending_supervisor_update.json`
- A cada iteração do loop, verificar `/var/lib/iscope-agent/supervisor_restart.flag` — se existir, fazer `sys.exit(0)`

`**supervisor/updater.py` (SupervisorUpdater):**

- Renomear para `WorkerUpdater` para clareza
- Na substituição de arquivos, NÃO substituir `supervisor/` — apenas `agent/`, `main.py`, `requirements.txt` e outros arquivos do Worker

`**supervisor/heartbeat.py`:**

- Passar `supervisor_version` junto com `agent_version` no heartbeat

#### 5. Worker (`agent/supervisor_updater.py` — NOVO)

Novo módulo que o Worker executa a cada tick:

```python
class SupervisorUpdater:
    """Worker atualiza o Supervisor (cross-update)."""
    
    PENDING_FILE = "/var/lib/iscope-agent/pending_supervisor_update.json"
    RESTART_FLAG = "/var/lib/iscope-agent/supervisor_restart.flag"
    SUPERVISOR_DIR = "/opt/iscope-agent/supervisor"
    
    def check_and_apply(self):
        # 1. Ler pending_supervisor_update.json
        # 2. Download do pacote iscope-supervisor-{version}.tar.gz
        # 3. Validar checksum
        # 4. Substituir supervisor/ no disco
        # 5. Escrever supervisor_restart.flag
        # 6. Remover pending file
```

`**main.py` (Worker):**

- Na `agent_loop()`, após processar tarefas, chamar `supervisor_updater.check_and_apply()`

#### 6. Packaging — Dois pacotes separados


| Pacote                               | Conteúdo                                | Bucket path                                         |
| ------------------------------------ | --------------------------------------- | --------------------------------------------------- |
| `iscope-agent-{version}.tar.gz`      | `agent/`, `main.py`, `requirements.txt` | `agent-releases/iscope-agent-{version}.tar.gz`      |
| `iscope-supervisor-{version}.tar.gz` | `supervisor/`                           | `agent-releases/iscope-supervisor-{version}.tar.gz` |


#### 7. Frontend — Página de Agents

Exibir ambas as versões no dashboard de agents:

- `Agent: v1.3.4`
- `Supervisor: v1.0.0`

### Fluxo Completo — Agent Update

```text
1. Admin define agent_latest_version = 1.3.4
2. Supervisor heartbeat: agent_version=1.3.3, supervisor_version=1.0.0
3. Backend: agent 1.3.3 < 1.3.4 → worker_update_available=true
4. Supervisor: download iscope-agent-1.3.4.tar.gz
5. Supervisor: stop Worker, replace agent/ + main.py, start Worker
6. Worker inicia com v1.3.4 ✓
7. Próximo heartbeat: agent_version=1.3.4, update_available=false ✓
```

### Fluxo Completo — Supervisor Update

```text
1. Admin define supervisor_latest_version = 1.1.0
2. Supervisor heartbeat: supervisor_version=1.0.0
3. Backend: supervisor 1.0.0 < 1.1.0 → supervisor_update_available=true
4. Supervisor: escreve pending_supervisor_update.json
5. Worker tick: lê pending file
6. Worker: download iscope-supervisor-1.1.0.tar.gz
7. Worker: replace supervisor/ no disco
8. Worker: escreve supervisor_restart.flag
9. Supervisor (próximo loop): detecta flag → sys.exit(0)
10. systemd: Restart=always → novo processo Supervisor v1.1.0 ✓
```

### Detalhes Técnicos


| Arquivo                                       | Ação                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `supabase/functions/agent-heartbeat/index.ts` | Aceitar `supervisor_version`, retornar `supervisor_update_info`        |
| DB migration                                  | Adicionar coluna `supervisor_version` em `agents` + settings           |
| `python-agent/agent/heartbeat.py`             | Incluir `supervisor_version` no payload (lido de `supervisor.version`) |
| `python-agent/agent/supervisor_updater.py`    | **NOVO** — Worker atualiza o Supervisor                                |
| `python-agent/main.py`                        | Chamar `SupervisorUpdater.check_and_apply()` no loop                   |
| `python-agent/supervisor/main.py`             | Verificar restart flag; escrever pending file                          |
| `python-agent/supervisor/updater.py`          | Não substituir `supervisor/` ao atualizar agent                        |
| `python-agent/supervisor/version.py`          | Manter versão independente                                             |
| `python-agent/agent/version.py`               | Permanece em 1.3.4                                                     |
| Frontend (AgentDetailPage / AgentsPage)       | Exibir `supervisor_version`                                            |
