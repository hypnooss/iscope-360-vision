

# Diagnostico: Arquitetura Atual vs. Arquitetura Ideal

## Como o Agent funciona HOJE

O Agent e um **processo unico** com **duas threads**:

```text
systemd (iscope-agent.service)
  └── main.py (PID unico)
        ├── Thread Principal: AgentScheduler → agent_loop() → TaskExecutor
        └── Thread Daemon: HeartbeatWorker → heartbeat + AutoUpdater
```

O `AutoUpdater` roda **dentro** do mesmo processo que ele tenta atualizar. Quando precisa fazer update:

1. Baixa o `.tar.gz`
2. Substitui os proprios arquivos em `/opt/iscope-agent/`
3. Chama `systemctl restart iscope-agent` ou `sys.exit(0)`

## Por que os agents nao atualizam de 1.2.10 para 1.3.x

O problema e exatamente o que voce suspeitou. A versao 1.2.10 **nao tem** o `HeartbeatWorker`. O codigo de auto-update em 1.2.10 pode ate baixar e substituir os arquivos, mas quando o processo reinicia com o codigo novo (1.3.x), a estrutura mudou drasticamente — novo `main.py`, novas classes, nova logica de inicializacao. Se qualquer incompatibilidade surgir (dependencias novas, configs novas), o agent quebra silenciosamente e volta a rodar a versao antiga, ou simplesmente nao reinicia.

**Para transicoes arquiteturais como essa, um `--update` manual e obrigatorio**, porque o installer bash faz coisas que o AutoUpdater interno nao faz: recria o venv, ajusta o systemd unit, instala componentes como root.

## O que falta: Arquitetura de dois processos (Supervisor + Worker)

O padrao que voce descreveu e o correto para updates confiaveis:

```text
systemd
  ├── iscope-supervisor.service (Processo 1 - LEVE, raramente muda)
  │     ├── Heartbeat
  │     ├── Auto-Update (baixa, valida, substitui arquivos do Worker)
  │     ├── Gerencia ciclo de vida do Worker (start/stop/restart)
  │     └── Reporta status e versao
  │
  └── iscope-agent.service (Processo 2 - WORKER, atualizado frequentemente)
        ├── TaskExecutor
        ├── Scheduler
        └── Toda logica de coleta/analise
```

**Vantagens:**

- O Supervisor e pequeno e estavel — raramente precisa de update manual
- O Worker pode ser atualizado, parado e reiniciado pelo Supervisor sem risco
- Mudancas arquiteturais no Worker (como adicionar HeartbeatWorker) sao transparentes
- Instalacao de dependencias e componentes do SO podem ser feitas pelo Supervisor como root antes de iniciar o Worker
- Se o Worker crashar, o Supervisor detecta e reinicia

## Plano de implementacao

### Fase 1: Criar o Supervisor (`python-agent/supervisor/`)

| Arquivo | Descricao |
|---|---|
| `supervisor/main.py` | Entrypoint do supervisor |
| `supervisor/heartbeat.py` | Heartbeat dedicado (reutiliza logica existente) |
| `supervisor/updater.py` | AutoUpdater melhorado — para o Worker antes de atualizar |
| `supervisor/worker_manager.py` | Start/stop/restart do processo Worker via subprocess |
| `supervisor/version.py` | Versao do Supervisor (independente do Worker) |

### Fase 2: Refatorar o Worker (`python-agent/agent/`)

- Remover `HeartbeatWorker` e `AutoUpdater` do Worker
- Worker foca exclusivamente em: auth, fetch tasks, execute tasks
- Worker expoe um health endpoint local (ex: arquivo PID + timestamp) para o Supervisor monitorar

### Fase 3: Dois services no systemd

```text
[Unit] iscope-supervisor.service
  - Sempre ativo
  - Inicia antes do agent
  - Reinicia automaticamente

[Unit] iscope-agent.service  
  - Gerenciado pelo Supervisor (nao pelo systemd directly)
  - Type=notify ou Type=simple
```

### Fase 4: Atualizar o installer bash

- Instala ambos os processos
- Flag `--update` atualiza o Supervisor primeiro, depois o Worker
- Para updates futuros, so o Supervisor precisa do `--update` manual (e ele e estavel)

### Fase 5: UI — Trigger de update pela GUI

- Na pagina Super Agents, botao "Forcar Update" por agent
- Backend seta flag no heartbeat response → Supervisor recebe e executa update do Worker
- Botao "Reinstalar Supervisor" para casos extremos (gera comando curl para copiar)

## Escopo desta implementacao

Esta e uma mudanca significativa no agente Python. Sugiro comecar pela **Fase 1 e 2** (Supervisor + refatoracao do Worker) como codigo, e depois voce faz deploy manual nos agents com `--update` pela ultima vez. A partir dai, updates futuros do Worker serao automaticos via Supervisor.

Quer que eu avance com este plano?

