
# Arquitetura Supervisor + Worker — Implementado

## Estrutura final

```text
systemd
  └── iscope-supervisor.service (root)
        ├── Heartbeat (envia status ao backend)
        ├── SupervisorUpdater (para Worker → atualiza → reinicia Worker)
        ├── WorkerManager (start/stop/restart do Worker via subprocess)
        └── Worker process (subprocess)
              ├── Auth + Token refresh
              ├── AgentScheduler → TaskExecutor
              └── Escreve health file a cada tick
```

## Arquivos criados

| Arquivo | Descrição |
|---|---|
| `supervisor/__init__.py` | Package init |
| `supervisor/main.py` | Entrypoint do Supervisor |
| `supervisor/config.py` | Configuração (lê mesmos envs do agent) |
| `supervisor/version.py` | Versão independente (1.0.0) |
| `supervisor/heartbeat.py` | Loop de heartbeat usando classes do agent |
| `supervisor/updater.py` | Download, validação, para Worker, substitui, reinicia |
| `supervisor/worker_manager.py` | Start/stop/restart do Worker via subprocess |
| `systemd/iscope-supervisor.service` | Unit do Supervisor (root) |
| `systemd/iscope-agent.service` | Unit do Worker (fallback/migração) |

## Alterações no Worker (main.py)

- Removidos: `HeartbeatWorker`, `AutoUpdater`, `AgentHeartbeat`
- Worker agora foca exclusivamente em: auth, fetch tasks, execute tasks
- Escreve `/var/lib/iscope-agent/worker.health` a cada tick para monitoramento

## Migração

Para migrar agents existentes, executar **uma última vez** o installer manual:

```bash
curl -fsSL <install-url> | sudo bash -s -- --update
```

O installer precisa ser atualizado para:
1. Instalar o Supervisor como serviço adicional
2. Desativar o antigo `iscope-agent.service` (gerenciado pelo systemd)
3. Ativar `iscope-supervisor.service` (que gerencia o Worker internamente)

A partir daí, updates futuros do Worker são automáticos via Supervisor.

## Próximos passos

- [ ] Atualizar installer bash para instalar Supervisor
- [ ] UI: Botão "Forçar Update" na página Super Agents
- [ ] UI: Indicador de versão desatualizada + cores no Last Seen
