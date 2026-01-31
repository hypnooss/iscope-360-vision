
## Ajuste do ponto “Leaked Password Protection”
- OK ignorar esse aviso. Ele é uma recomendação de segurança, mas não é requisito para o fluxo do Agent (registro/heartbeat/tarefas) funcionar.
- Não vamos bloquear a implementação por causa disso.

## Observação importante (tipos Supabase)
- Vi no histórico que `src/integrations/supabase/types.ts` foi editado. Esse arquivo deveria ser “gerado” (representa o schema atual do Supabase) e normalmente não deve ser alterado manualmente.
- No plano de implementação, vamos **reverter qualquer alteração manual** nele e manter o workaround já usado no projeto (`from("agents" as any)`), para não depender de tipos “na mão”.

---

## Objetivo (resultado final para usuário leigo)
1) Na criação do Agent: exibir **comando pronto** para copiar/colar (`curl | bash` com activation code) + botões “Copiar”, “Verificar status”, “Ver logs”.
2) Na lista de Agents: botão “Instruções” para Agents pendentes, abrindo um modal com o mesmo conteúdo.
3) No servidor Linux: o comando instala dependências (Python + libs), baixa o pacote do agent, cria config em `/etc/iscope`, state em `/var/lib/iscope`, instala serviço `iscope-agent` e inicia.

---

## O que já está encaminhado
### Bucket `agent-releases`
- Migração cria/força o bucket público `agent-releases` e adiciona uma policy de leitura pública no `storage.objects`.
- Ajuste de robustez que faremos: a policy pode falhar se já existir (Postgres não tem `CREATE POLICY IF NOT EXISTS`). Vamos tornar a migração idempotente usando um `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN ... END $$;`.

---

## Implementação (passo a passo)

### 1) Backend: Edge Function `agent-install` (serve o install.sh)
**Criar** `supabase/functions/agent-install/index.ts`:
- Responder `GET` e `OPTIONS` com CORS.
- `Content-Type: text/plain; charset=utf-8`.
- Devolver um bash script “single file”, com:
  - `set -euo pipefail`
  - parse de flags (mínimo): `--activation-code`, `--version`, `--poll-interval`, `--install-dir`, `--config-dir`, `--state-dir`, `--update`, `--uninstall`
  - valores default:
    - config: `/etc/iscope`
    - state: `/var/lib/iscope`
    - install dir: `/opt/iscope-agent`
    - service: `iscope-agent`
    - user: `iscope`
    - poll interval default: `120`
  - URLs fixas do Supabase (sem `VITE_*`):
    - `API_BASE_URL=https://akbosdbyheezghieiefz.supabase.co/functions/v1`
    - download do pacote em storage: `https://akbosdbyheezghieiefz.supabase.co/storage/v1/object/public/agent-releases/<arquivo>`
- Segurança/privacidade:
  - Nunca imprimir activation code completo em logs. Se precisar, mascarar (ex.: `ABCD-****-****-WXYZ`).

**Script: etapas internas**
- Detectar distro via `/etc/os-release`.
- Instalar dependências:
  - Debian/Ubuntu: `python3 python3-venv python3-pip build-essential libssl-dev libffi-dev`
  - RHEL-like: `python3 python3-pip gcc openssl-devel libffi-devel` (e checar `python3 -m venv`)
- Criar user `iscope` (system user, sem shell) se não existir.
- Criar diretórios:
  - `/etc/iscope`
  - `/var/lib/iscope`
  - `/opt/iscope-agent`
- Baixar pacote `iscope-agent-<version>.tar.gz` (ou `iscope-agent-latest.tar.gz`) e extrair em `/opt/iscope-agent`.
- Criar venv e instalar requirements.
- Criar `/etc/iscope/agent.env` (chmod 600) contendo:
  - `AGENT_API_BASE_URL=.../functions/v1`
  - `AGENT_POLL_INTERVAL=...`
  - `AGENT_STATE_FILE=/var/lib/iscope/state.json`
  - `AGENT_ACTIVATION_CODE=...`
  - (opcional) `AGENT_LOG_MODE=journald`
- Criar state file inicial se não existir.
- Criar `/etc/systemd/system/iscope-agent.service` e habilitar/rodar.
- Mensagens finais com comandos:
  - `systemctl status iscope-agent --no-pager`
  - `journalctl -u iscope-agent -f --no-pager`

**Atualizar** `supabase/config.toml`:
- Adicionar:
  ```toml
  [functions.agent-install]
  verify_jwt = false
  ```
  (o instalador precisa ser público)

---

### 2) Python Agent: suportar `/etc/iscope/agent.env` e padrão Linux
**Atualizar** `python-agent/agent/config.py`:
- Carregar env do caminho padrão primeiro:
  - `load_dotenv("/etc/iscope/agent.env")` (se existir)
  - fallback: `load_dotenv()` (dev/local)
- Defaults:
  - `STATE_FILE` default: `/var/lib/iscope/state.json` (em vez de relativo)
  - `POLL_INTERVAL` continua com default 120 (já está 120 hoje)
- Manter compatibilidade com `.env` local e variáveis já existentes.

**Atualizar** `python-agent/agent/logger.py`:
- Manter logging para stdout (journald).
- Tornar log em arquivo opcional (controlado por env var), por exemplo:
  - se `AGENT_LOG_FILE` definido, ativa RotatingFileHandler
  - caso contrário, só stream handler
- Evitar criar `logs/` relativo por padrão (para não “poluir” instalação em /opt).

---

### 3) Frontend: comando pronto no fluxo de criação + “Instruções” na lista
**Atualizar** `src/pages/AgentsPage.tsx` (já existe UI de activation code):
1) Depois que `activationCode` existe (Agent criado):
   - Mostrar um bloco adicional “Instalar agent (Linux)”:
     - Comando:
       ```bash
       curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "XXXX-XXXX-XXXX-XXXX"
       ```
     - Botão “Copiar comando”
     - Botão “Copiar verificação” (ex.: `systemctl status iscope-agent --no-pager`)
     - Botão “Copiar logs” (ex.: `journalctl -u iscope-agent -f --no-pager`)
   - Texto bem simples explicando: “Cole no servidor Linux”.

2) Na tabela de Agents:
   - Para status “Pendente” (por exemplo: `!agent.last_seen && !!agent.activation_code && !agent.revoked`):
     - Adicionar botão “Instruções” (ícone) em Ações.
     - Ao clicar, abrir `Dialog` com:
       - comando `curl | bash` preenchido com `agent.activation_code`
       - os botões copiar (com feedback toast)
       - checklist simples (3 itens)

3) Dialog de detalhes do Agent:
   - Se o Agent ainda tiver `activation_code`, mostrar o comando também.

**Importante (tipo de dados)**
- Vamos manter o pattern já existente:
  - `from("agents" as any)`
- E reverter quaisquer alterações manuais em `types.ts`.

---

### 4) Publicação do pacote do Agent no Storage
- Gerar `iscope-agent-latest.tar.gz` contendo:
  - `python-agent/main.py`
  - `python-agent/agent/**`
  - `python-agent/requirements.txt`
- Upload no bucket `agent-releases` (public).

Observação: isso é um passo operacional que você pode fazer pelo painel do Supabase Storage, ou podemos automatizar depois com uma rotina de release. No primeiro ciclo, manter manual é ok.

---

## Testes (end-to-end)
1) Criar Agent no painel → copiar comando.
2) Rodar em VM Ubuntu 22.04/24.04:
   - confirmar `systemctl status iscope-agent`
   - confirmar logs em `journalctl -u iscope-agent -n 100`
3) Confirmar no painel que `last_seen` atualiza e status muda para “Online”.
4) Testar erro de activation code inválido: instalador deve falhar com mensagem clara (“gere um novo código no painel”).

---

## Entregáveis finais (o que você verá pronto)
- Edge Function `agent-install` publicada e acessível via URL Supabase.
- UI em `/agents` com comandos de instalação copiáveis.
- Agent Python lendo config de `/etc/iscope/agent.env`, state em `/var/lib/iscope/state.json`, logs via journald.
- Storage `agent-releases` com leitura pública para baixar o tar.gz.

