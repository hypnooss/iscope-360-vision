
Contexto e objetivo (para usuário leigo)
- Hoje a instalação do Agent exige “trabalho de técnico”: copiar arquivos, criar serviço, editar .env, preparar state.json, instalar dependências.
- O objetivo é transformar isso em algo de 1 comando, copiando e colando, com o activation code já embutido (sem a pessoa abrir arquivo nenhum).

Decisões que você confirmou agora
- Linux primeiro (multi-distro), usando systemd e sudo.
- Instalação com flags/vars (sem perguntas interativas).
- Distribuição via `curl | bash`, hospedada “no app”.
- Layout de pastas padrão Linux:
  - Config em `/etc/iscope`
  - State em `/var/lib/iscope`
  - Logs no journald (systemctl/journalctl)
- Serviço systemd: `iscope-agent`
- Instalação sempre exige activation code no comando.

O que vamos entregar (experiência final)
1) Na tela de criação do Agent (quando o código aparece), o usuário vai ver:
- “Passo 1: copie o comando abaixo”
- Um bloco com o comando completo (já com activation code e api base url)
- Botão “Copiar comando”
- “Passo 2: cole no servidor Linux (como root ou com sudo)”
- “Como verificar se funcionou” (3 comandos curtos)

2) Na lista de Agents (/agents), cada Agent “Pendente” terá um botão “Instruções” que abre um modal com:
- Comando pronto para copiar/colar (com activation code daquele Agent)
- Botões: “Copiar comando”, “Copiar verificação”, “Copiar logs”
- Checklist simples: Instalou? Serviço rodando? Heartbeat aparecendo?

3) No servidor Linux, a pessoa cola:
```bash
curl -fsSL https://SEU_APP/agent/install.sh | sudo bash -s -- \
  --activation-code "XXXX-XXXX-XXXX-XXXX"
```
E pronto: instala, configura e inicia o serviço.

Arquitetura proposta (como hospedar “no app” de forma prática)
Como seu projeto é um app React (frontend estático), o jeito mais confiável de “hospedar no app” sem depender de servidor tradicional é usar Supabase para servir os arquivos do instalador:

A) Supabase Edge Function para servir o script (URL estável)
- Criar uma Edge Function pública (ex.: `agent-install`) que retorna o bash script com:
  - `Content-Type: text/plain`
  - Script já “ciente” do base URL das Edge Functions do seu projeto (`https://akbosdbyheezghieiefz.supabase.co/functions/v1`)
- Vantagem: a URL do install não depende do build do Vite nem de “Published URL”.

B) Supabase Storage para o pacote do Agent
- Criar um bucket público (ex.: `agent-releases`)
- Guardar um pacote versionado (ex.: `iscope-agent-1.0.0.tar.gz`) contendo a pasta `python-agent/` necessária para rodar.
- O script baixa esse tar.gz do Storage e instala.
- Vantagem: conseguimos atualizar o Agent sem precisar “mexer em servidor” e sem depender do usuário baixar zip.

Nota: O “hospedar no app” aqui, na prática, vira “hospedar no backend do seu app (Supabase)”, que para o usuário é a mesma experiência: ele só usa a URL do seu produto e pronto.

Comportamento do instalador (o que o script fará)
Script: `install.sh` (bash, não interativo, só flags)
Flags principais:
- `--activation-code "XXXX-XXXX-XXXX-XXXX"` (obrigatória)
- `--version "1.0.0"` (opcional; default: latest)
- `--install-dir "/opt/iscope-agent"` (opcional)
- `--config-dir "/etc/iscope"` (opcional; default: /etc/iscope)
- `--state-dir "/var/lib/iscope"` (opcional; default: /var/lib/iscope)
- `--poll-interval 120` (opcional; default 120)
- `--uninstall` (opcional)
- `--update` (opcional)

O que o script executa:
1) Pré-checks (para não dar erro “misterioso”)
- Verifica se está rodando como root (ou via sudo).
- Verifica se existe systemd (`systemctl`).
- Detecta distro via `/etc/os-release` para instalar dependências.

2) Garantir Python e libs (seu ponto #4)
- Instala dependências do sistema:
  - Debian/Ubuntu: `apt-get update && apt-get install -y python3 python3-venv python3-pip`
  - RHEL/CentOS/Rocky: `dnf install -y python3 python3-pip` (e cria venv via python3 -m venv se disponível)
- Instala dependências “de build” quando necessário para wheels (principalmente `paramiko`/`cryptography`):
  - Debian/Ubuntu: `build-essential libffi-dev libssl-dev`
  - RHEL: `gcc openssl-devel libffi-devel`
- Cria venv e roda `pip install -r requirements.txt`

3) Criar usuário e diretórios
- Cria usuário de serviço (ex.: `iscope`) sem shell (segurança).
- Cria:
  - `/opt/iscope-agent` (código + venv)
  - `/etc/iscope/agent.env` (config)
  - `/var/lib/iscope/state.json` (estado persistente)
- Permissões corretas:
  - `/etc/iscope/agent.env` com `chmod 600`
  - `state.json` com owner do usuário do serviço

4) Gerar config sem o usuário editar .env (seu ponto #3)
- Escreve `/etc/iscope/agent.env` com:
  - `AGENT_API_BASE_URL=https://akbosdbyheezghieiefz.supabase.co/functions/v1`
  - `AGENT_POLL_INTERVAL=120`
  - `AGENT_STATE_FILE=/var/lib/iscope/state.json`
  - `AGENT_ACTIVATION_CODE=XXXX-...`
  - (novo) `AGENT_LOG_MODE=journald` ou `AGENT_LOG_DIR=...` (se decidirmos também gravar arquivo)

5) Instalar e iniciar o serviço systemd
- Cria `/etc/systemd/system/iscope-agent.service` com:
  - `EnvironmentFile=/etc/iscope/agent.env`
  - `WorkingDirectory=/opt/iscope-agent`
  - `ExecStart=/opt/iscope-agent/venv/bin/python /opt/iscope-agent/main.py`
  - `Restart=always`
  - `User=iscope`
- `systemctl daemon-reload`
- `systemctl enable --now iscope-agent`

6) Mensagens finais “para leigo”
- Mostra:
  - “Instalado com sucesso”
  - Como ver status: `systemctl status iscope-agent --no-pager`
  - Como ver logs: `journalctl -u iscope-agent -f --no-pager`

Mudanças necessárias no Python Agent (para suportar /etc/iscope + padrão Linux)
Hoje:
- `python-agent/agent/config.py` usa `load_dotenv()` sem caminho e defaults locais (`storage/state.json`)
- `python-agent/agent/logger.py` escreve log em pasta relativa `logs/`

Vamos ajustar para produção (mantendo compatibilidade):
1) Config: carregar `/etc/iscope/agent.env` por padrão
- Em `agent/config.py`:
  - tentar `load_dotenv("/etc/iscope/agent.env")` primeiro
  - fallback: `load_dotenv()` (para dev local)
- Ajustar defaults:
  - `STATE_FILE` default: `/var/lib/iscope/state.json` (não relativo)
  - `POLL_INTERVAL` continua igual

2) Logs: priorizar journald (systemd) e opcionalmente arquivo
- Alterar `logger.py` para:
  - sempre logar em stdout (systemd captura no journald)
  - log em arquivo só se uma env var estiver definida (ex.: `AGENT_LOG_FILE` ou `AGENT_LOG_DIR`)
- Isso evita que o usuário precise “achar pasta logs” e centraliza tudo no `journalctl`.

3) UX de erro para leigos (opcional, mas recomendado)
- Mensagens mais claras se:
  - activation code ausente
  - state.json sem permissão
  - python/pip ausentes

Mudanças necessárias na UI (para “copiar e colar com activation code”)
Arquivo principal: `src/pages/AgentsPage.tsx`

1) No fluxo “Agent criado” (onde hoje só mostra o código):
- Adicionar um bloco “Instale com este comando” com:
  - comando completo `curl | sudo bash ... --activation-code "..."`.
  - botão copiar comando
  - botão copiar “ver status”
  - botão copiar “ver logs”
- Importante: o usuário não entende “api base url”, então isso fica invisível; o comando já vem pronto.

2) Botão “Instruções” na lista de Agents
- Para Agents com status “Pendente” (activation_code ainda existe):
  - adicionar um botão (ícone) “Instruções” na coluna Ações
  - abre um Dialog com o mesmo conteúdo (comandos + verificação)

3) Detalhes do Agent: mostrar comando quando existir activation_code
- Hoje o dialog “Detalhes” só permite “Gerar novo código”.
- Ajustar para também mostrar:
  - “Código atual” (se existir)
  - comando de instalação pronto

Como vamos montar o comando (importante para Lovable)
- Não usar VITE_*.
- Usar URL estável do Supabase:
  - Instalador: `https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install`
  - Backend do agent (já é): `https://akbosdbyheezghieiefz.supabase.co/functions/v1`
- Então o comando gerado na UI será algo como:
```bash
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "XXXX-XXXX-XXXX-XXXX"
```
Vantagem: funciona mesmo antes do app estar “Published”, e não depende do domínio do frontend.

Empacotamento do agent (o que entra no tar.gz)
Conteúdo mínimo:
- `python-agent/main.py`
- `python-agent/agent/**`
- `python-agent/requirements.txt`
- `python-agent/.env.example` (opcional)
- (opcional) `VERSION` para debug

Processo de release (simples)
- Subir um `iscope-agent-latest.tar.gz` no bucket `agent-releases`
- O install.sh por padrão baixa `latest`
- Se você quiser pin (para ambientes críticos), usa `--version 1.0.0` e o script baixa `iscope-agent-1.0.0.tar.gz`

Checklist de testes (end-to-end)
A) Teste de instalação (VM limpa)
1. Criar Agent no painel, copiar comando.
2. Rodar comando na VM Ubuntu/Debian.
3. Verificar:
   - `systemctl status iscope-agent`
   - `journalctl -u iscope-agent -n 50`
4. Confirmar no painel que o Agent muda de “Pendente” para “Online” após heartbeat.

B) Teste em distro RHEL-like
- Repetir com Rocky/Alma/CentOS Stream.

C) Teste de erro (para leigo)
- activation code inválido: script termina com mensagem clara e aponta “gere um novo código no painel”.
- sem systemd: script informa que precisa systemd (e sugere alternativa futura).

Escopo futuro (não entra agora, mas já fica desenhado)
- Windows installer (PowerShell) + Windows Service (NSSM ou sc.exe).
- Docker (para ambientes sem systemd).

Arquivos / áreas que serão mexidas quando você aprovar a implementação
Frontend:
- `src/pages/AgentsPage.tsx` (instruções + copiar comando + botão de instruções)

Supabase:
- Nova Edge Function: `supabase/functions/agent-install/index.ts` (serve o bash)
- Storage: criar bucket `agent-releases` e publicar o tar.gz (via painel do Supabase)

Python Agent:
- `python-agent/agent/config.py` (carregar /etc/iscope/agent.env, defaults para /var/lib/iscope)
- `python-agent/agent/logger.py` (journald-first, arquivo opcional via env)

Notas e riscos
- `curl | bash` exige extremo cuidado: vamos manter script simples, com `set -euo pipefail`, mensagens claras e validação básica de download.
- Dependências Python podem falhar em ambientes muito antigos (ex.: OpenSSL antigo). Vamos capturar e imprimir instruções “o que fazer” em português simples.
- Como o activation code é sensível, o script não deve logar o código em stdout nem em journald (vamos mascarar).

Resultado final esperado
- Uma pessoa sem conhecimento técnico:
  - cria o Agent no painel
  - clica “Copiar comando”
  - cola no servidor
  - volta no painel e vê o Agent “Online”
