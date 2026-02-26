

## Diagnostico real

O log mostra claramente:

```text
CGroup: /system.slice/iscope-supervisor.service
        ├─2708036 /opt/iscope-agent/venv/bin/python -m supervisor.main
        └─2708039 /opt/iscope-agent/venv/bin/python /opt/iscope-agent/main.py
```

O Worker (main.py) roda como subprocesso do Supervisor. Isso e BY DESIGN na arquitetura atual — `WorkerManager.start()` usa `subprocess.Popen`. Quando o Supervisor morre, o Worker morre junto. Nao sao servicos independentes.

Alem disso, `supervisor_version` e NULL para TODOS os 30+ agents no banco porque o codigo no host ainda nao envia esse campo (o fix no `heartbeat.py` so existe no repo, nao foi deployed).

## Plano: Separar em 2 servicos systemd independentes

### Arquitetura alvo

```text
systemd
├── iscope-supervisor.service (root)
│   └── python -m supervisor.main
│       - Heartbeat
│       - Updates (download + replace)
│       - Remote commands
│       - Gerencia Worker via systemctl (nao subprocess)
│
└── iscope-agent.service (root)
    └── python main.py
        - Task execution
        - Health file
        - Cross-update (supervisor updates)
```

### 1. Reescrever `python-agent/supervisor/worker_manager.py`

Substituir `subprocess.Popen` por `systemctl start/stop/restart iscope-agent`. Remover toda logica de subprocess, stdout pipe, PID file manual.

```python
class WorkerManager:
    def start(self):
        subprocess.run(["systemctl", "start", "iscope-agent"], check=True)

    def stop(self):
        subprocess.run(["systemctl", "stop", "iscope-agent"], check=True)

    def restart(self):
        subprocess.run(["systemctl", "restart", "iscope-agent"], check=True)

    def is_running(self):
        result = subprocess.run(
            ["systemctl", "is-active", "iscope-agent"],
            capture_output=True, text=True
        )
        return result.stdout.strip() == "active"

    def is_healthy(self, max_age=300):
        # Continua usando health file
        ...

    def collect_output(self):
        return ""  # Logs vao direto pro journal
```

### 2. Simplificar `python-agent/supervisor/main.py`

- Remover `worker.collect_output()` e o print `[Worker]` (logs vao pro journal do iscope-agent)
- `worker.start()` agora faz `systemctl start iscope-agent`
- Manter toda logica de heartbeat, updates, remote commands

### 3. Atualizar `python-agent/systemd/iscope-agent.service`

Remover nota de "fallback". Tornar servico primario:

```ini
[Unit]
Description=iScope 360 Agent (Worker)
After=network-online.target iscope-supervisor.service
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/opt/iscope-agent
EnvironmentFile=-/etc/iscope/agent.env
ExecStart=/opt/iscope-agent/venv/bin/python main.py
Restart=on-failure
RestartSec=15
StandardOutput=journal
StandardError=journal
SyslogIdentifier=iscope-agent

[Install]
WantedBy=multi-user.target
```

Mudancas chave: User=root (precisa de nmap, masscan), After inclui iscope-supervisor.

### 4. Atualizar `python-agent/systemd/iscope-supervisor.service`

Adicionar dependencia do Worker:

```ini
[Unit]
Description=iScope 360 Supervisor
After=network-online.target
Wants=network-online.target iscope-agent.service
```

### 5. Atualizar scripts de instalacao (Edge Functions)

**`supabase/functions/agent-install/index.ts`**: Na funcao `write_systemd_service()`, gerar DOIS unit files:
- `/etc/systemd/system/iscope-supervisor.service`
- `/etc/systemd/system/iscope-agent.service`

Na funcao `start_service()`:
```bash
systemctl daemon-reload
systemctl enable iscope-supervisor iscope-agent
systemctl start iscope-agent
systemctl start iscope-supervisor
```

**`supabase/functions/super-agent-install/index.ts`**: Mesma mudanca.

### 6. Atualizar `stop_service_if_exists` e `uninstall_all`

Parar e desabilitar ambos os servicos:
```bash
for svc in iscope-supervisor iscope-agent; do
  systemctl stop "$svc" || true
  systemctl disable "$svc" || true
done
```

### 7. Frontend: supervisor_version ja esta no codigo

O frontend ja exibe `supervisor_version` via `(agent as any).supervisor_version` em `AgentsPage.tsx` (linha 623) e `AgentDetailPage.tsx` (linha 470). O problema e que o valor e NULL no banco porque o codigo deployed nos hosts ainda nao envia o campo. Apos rebuild dos pacotes com o `heartbeat.py` corrigido, o campo sera populado.

### Arquivos impactados

| Arquivo | Mudanca |
|---------|---------|
| `python-agent/supervisor/worker_manager.py` | Reescrever: subprocess.Popen → systemctl |
| `python-agent/supervisor/main.py` | Remover `collect_output()` e print `[Worker]` |
| `python-agent/systemd/iscope-agent.service` | Tornar servico primario, User=root |
| `python-agent/systemd/iscope-supervisor.service` | Adicionar Wants=iscope-agent.service |
| `supabase/functions/agent-install/index.ts` | Gerar 2 unit files, start ambos |
| `supabase/functions/super-agent-install/index.ts` | Mesma mudanca |

### Deploy

1. Aplicar mudancas no repo
2. Deploy edge functions (`agent-install`, `super-agent-install`)
3. Rebuild pacotes tar (agent + supervisor) com todos os fixes
4. Upload para bucket
5. Rodar `--update` no host de teste
6. Verificar: `systemctl status iscope-supervisor` (1 processo), `systemctl status iscope-agent` (1 processo)

