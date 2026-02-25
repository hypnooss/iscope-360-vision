

# Hotfix: Installer configura apenas o Worker, sem Supervisor (sem heartbeat)

## Problema

O script `agent-install` configura o serviço `iscope-agent.service` que executa `main.py` (Worker). O Worker **apenas processa tarefas** -- ele **não envia heartbeats**. Os heartbeats são responsabilidade do **Supervisor** (`supervisor/main.py`), que nunca é configurado pelo installer.

Resultado: o agent funciona (processa tarefas normalmente), mas o backend nunca recebe heartbeats, então mostra o agent como **Offline**.

```text
Arquitetura atual (no código):
┌─────────────────┐     ┌─────────────────┐
│   Supervisor    │────▸│     Worker      │
│  - heartbeat    │     │  - tasks only   │
│  - updates      │     │  - health file  │
│  supervisor.main│     │  main.py        │
└─────────────────┘     └─────────────────┘

O que o installer faz hoje:
                        ┌─────────────────┐
                        │     Worker      │  ← sozinho, sem heartbeat
                        │  main.py        │
                        └─────────────────┘
```

## Solução

Alterar a Edge Function `agent-install` para:

1. **Criar o serviço `iscope-supervisor`** em vez do `iscope-agent` como processo principal
   - O Supervisor roda como `root` (precisa gerenciar subprocessos e componentes do sistema)
   - O Supervisor inicia o Worker como subprocess automaticamente
   - O Supervisor envia heartbeats e gerencia updates

2. **Na migração (--update)**: parar o serviço antigo `iscope-agent`, criar o novo `iscope-supervisor`, e desabilitar o antigo

3. **Manter backward compatibility**: se `iscope-agent` existia, desabilitá-lo e criar `iscope-supervisor`

### Mudanças no `write_systemd_service()`

O unit file passa a ser `iscope-supervisor.service`:

```bash
ExecStart=${INSTALL_DIR}/venv/bin/python -m supervisor.main
User=root
```

Em vez de:

```bash
ExecStart=${INSTALL_DIR}/venv/bin/python ${INSTALL_DIR}/main.py
User=iscope
```

### Mudanças no `stop_service_if_exists()`

Parar tanto `iscope-agent` quanto `iscope-supervisor` durante update.

### Mudanças no `start_service()`

Habilitar `iscope-supervisor` e desabilitar `iscope-agent` se existir.

### Mudanças no `write_env_file()`

Adicionar `SUPERVISOR_HEARTBEAT_INTERVAL` ao `agent.env`.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/agent-install/index.ts` | Alterar `write_systemd_service()`, `stop_service_if_exists()`, `start_service()`, `write_env_file()`, e mensagens de sucesso para usar Supervisor |
| `supabase/functions/super-agent-install/index.ts` | Mesmas alterações (consistência entre os dois installers) |

## Detalhes da alteração no agent-install

1. **`SERVICE_NAME`**: mudar de `"iscope-agent"` para `"iscope-supervisor"`
2. **`write_systemd_service()`**: unit file aponta para `python -m supervisor.main`, roda como `root`
3. **`stop_service_if_exists()`**: parar ambos `iscope-agent` e `iscope-supervisor`
4. **`start_service()`**: habilitar `iscope-supervisor`, desabilitar `iscope-agent`
5. **`write_env_file()`**: incluir `SUPERVISOR_HEARTBEAT_INTERVAL=120`
6. **Mensagens finais**: ajustar para referenciar `iscope-supervisor`

Após o deploy da Edge Function, basta re-executar `curl ... | sudo bash -s -- --update` no servidor e o Supervisor assumirá o controle, enviando heartbeats e gerenciando o Worker.

