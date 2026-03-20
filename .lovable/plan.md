

## Plano: Atualizar README.md do python-agent

### Problemas Identificados

O README atual reflete a arquitetura antiga (processo único, v1.2.10). O codebase evoluiu significativamente:

| Item | README atual | Realidade |
|------|-------------|-----------|
| Versão | 1.2.10 | Agent 1.3.14, Supervisor 1.2.1, Monitor 1.1.1 |
| Arquitetura | Processo único (Worker) | 3 processos: Worker + Supervisor + Monitor |
| Supervisor | Não mencionado | Heartbeats, updates, worker lifecycle, realtime shell |
| Monitor | Não mencionado | Coleta de métricas, serviço independente |
| systemd | 1 serviço | 3 serviços (iscope-agent, iscope-supervisor, iscope-monitor) |
| Executores | 12 listados (falta domain_whois) | 13 executores |
| Arquivos agent/ | Faltam 4 arquivos | heartbeat_worker, realtime_commands, remote_commands, supervisor_updater |
| urllib3 | `>=2.0.0` | `>=1.26.0,<2.0.0` |
| websocket-client | Não listado | Presente no requirements.txt |
| Recovery (agent-fix) | Não mencionado | Edge Function de recuperação |
| Supabase Realtime | Não mencionado | Variáveis SUPABASE_URL e SUPABASE_ANON_KEY |
| Bootstrap/rollback | Não mencionado | supervisor_bootstrap.sh com rollback automático |
| Boot-time deps | Não mencionado | _ensure_dependencies no supervisor |

### Mudanças no README

**1. Header e versão** — Atualizar para refletir as 3 versões (Agent 1.3.14, Supervisor 1.2.1, Monitor 1.1.1)

**2. Nova seção "Arquitetura"** — Diagrama ASCII do modelo 3 processos com responsabilidades de cada um

**3. Seção "Execução / systemd"** — Listar os 3 serviços com comandos para cada um

**4. Seção "Supervisor"** — Bootstrap com rollback, heartbeats, worker lifecycle, Realtime (shell + wake listener), cross-update, graceful shutdown (SIGTERM)

**5. Seção "Monitor"** — Coleta de métricas, log rotation, serviço independente

**6. Atualizar "Módulos/Executores"** — Adicionar `domain_whois` (13 executores)

**7. Atualizar "Sistema de Auto-Update"** — Refletir arquitetura atual: Supervisor gerencia updates do Worker e Monitor; Worker gerencia cross-update do Supervisor

**8. Nova seção "Recuperação (agent-fix)"** — Comando curl, o que faz, quando usar

**9. Atualizar "Variáveis de Ambiente"** — Adicionar SUPABASE_URL, SUPABASE_ANON_KEY, SUPERVISOR_HEARTBEAT_INTERVAL, MONITOR_INTERVAL

**10. Atualizar "Estrutura de Arquivos"** — Incluir supervisor/, monitor/, systemd/, supervisor_bootstrap.sh, check-deps.sh

**11. Corrigir "Dependências Python"** — urllib3 para `>=1.26.0,<2.0.0`, adicionar `websocket-client>=1.7.0`

**12. Atualizar Troubleshooting** — Comandos para os 3 serviços, seção agent-fix

### Arquivo a alterar

| Arquivo | Mudança |
|---------|---------|
| `python-agent/README.md` | Reescrita completa mantendo estrutura/estilo |

