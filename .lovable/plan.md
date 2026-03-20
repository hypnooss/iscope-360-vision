## Plano: Estratégia de Deploy dos 3 Módulos

### Situação Atual

As correções foram aplicadas no código mas os version.py não foram incrementados. Como as versões no código = versões no system_settings, o heartbeat nunca sinaliza update disponível.

### Novas Versões Propostas


| Módulo     | Atual  | Nova       | Mudanças                                                     |
| ---------- | ------ | ---------- | ------------------------------------------------------------ |
| Supervisor | 1.2.0  | **1.2.1**  | Graceful shutdown (SIGTERM), boot-time deps, tempfile seguro |
| Monitor    | 1.1.0  | **1.1.1**  | Log rotation com RotatingFileHandler                         |
| Agent      | 1.3.13 | **1.3.14** | Tempfile seguro, thumbprint.txt alinhado                     |


### Sequência de Deploy (conforme arquitetura documentada)

**Etapa 1 — Bump de versões**

- Atualizar `supervisor/version.py` → 1.2.1
- Atualizar `monitor/version.py` → 1.1.1
- Atualizar `agent/version.py` → 1.3.14

**Etapa 2 — Gerar tarballs e calcular checksums**
Criar script que:

1. Empacota cada módulo no formato esperado (`iscope-supervisor-1.2.1.tar.gz`, etc.)
2. Calcula SHA256 de cada tarball
3. Inclui `requirements.txt` no pacote do agent

**Etapa 3 — Upload para Storage**
Upload dos 3 tarballs para o bucket `agent-releases` (privado, signed URLs)

**Etapa 4 — Atualizar system_settings**
Atualizar no banco:

- `supervisor_latest_version` → 1.2.1
- `supervisor_update_checksum` → (sha256 do tarball)
- `monitor_latest_version` → 1.1.1
- `monitor_update_checksum` → (sha256 do tarball)
- `agent_latest_version` → 1.3.14
- `agent_update_checksum` → (sha256 do tarball)

**Etapa 5 — Verificação**
Após o próximo heartbeat (~120s), os agents devem:

1. Receber `supervisor_update_available: true` → Worker baixa e aplica, Supervisor reinicia
2. Receber `monitor_update_available: true` → Supervisor baixa e reinicia serviço
3. Receber `update_available: true` → Supervisor baixa e reinicia Worker

### Ordem de execução no servidor (automática)

O Supervisor processa as 3 atualizações na ordem em que aparecem no heartbeat response. O fluxo real é:

1. **Agent update** — Supervisor para Worker, aplica, reinicia Worker
2. **Supervisor update** — Worker detecta sinal, baixa pacote, aplica, seta restart flag → Supervisor reinicia via systemd
3. **Monitor update** — Supervisor baixa, substitui monitor/, reinicia serviço iscope-monitor

### Arquivos a alterar


| Arquivo                              | Mudança         |
| ------------------------------------ | --------------- |
| `python-agent/supervisor/version.py` | 1.2.0 → 1.2.1   |
| `python-agent/monitor/version.py`    | 1.1.0 → 1.1.1   |
| `python-agent/agent/version.py`      | 1.3.13 → 1.3.14 |


### Ações pós-código (script)

- Gerar tarballs dos 3 módulos
- Upload para bucket `agent-releases`
- Atualizar `system_settings` com versões e checksums