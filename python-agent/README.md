# iScope 360 — Python Agent

**Versões atuais: Agent 1.3.14 · Supervisor 1.2.1 · Monitor 1.1.1**

Agent Python para comunicação com o backend do iScope 360. Executa em servidores Linux como um sistema de 3 processos independentes (Worker + Supervisor + Monitor), envia heartbeats periódicos, processa tarefas de coleta (firewalls, domínios externos, M365 PowerShell, attack surface scanning), coleta métricas do servidor e suporta atualização automática com rollback.

## Índice

- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação Automática (Produção)](#instalação-automática-produção)
- [Opções do Script de Instalação](#opções-do-script-de-instalação)
- [Instalação Manual (Desenvolvimento)](#instalação-manual-desenvolvimento)
- [Configuração](#configuração)
- [Execução / systemd](#execução--systemd)
- [Supervisor](#supervisor)
- [Monitor](#monitor)
- [Fluxo de Autenticação](#fluxo-de-autenticação)
- [Endpoints Utilizados](#endpoints-utilizados)
- [Sistema de Tarefas](#sistema-de-tarefas)
- [Módulos/Executores](#módulosexecutores)
- [Pipeline de Attack Surface](#pipeline-de-attack-surface)
- [Gerenciamento de Componentes](#gerenciamento-de-componentes)
- [Sistema de Auto-Update](#sistema-de-auto-update)
- [Scheduler com Exponential Backoff](#scheduler-com-exponential-backoff)
- [Recuperação (agent-fix)](#recuperação-agent-fix)
- [Compatibilidade de Sistemas](#compatibilidade-de-sistemas)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Tratamento de Erros](#tratamento-de-erros)
- [Troubleshooting](#troubleshooting)
- [Dependências Python](#dependências-python)

---

## Arquitetura

O iScope Agent opera como **3 processos independentes**, cada um gerenciado por um serviço systemd:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ARQUITETURA iScope Agent (3 processos)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────┐                                   │
│  │  iscope-supervisor (systemd)     │                                   │
│  │  supervisor/main.py              │                                   │
│  │                                  │                                   │
│  │  • Heartbeats com o backend      │                                   │
│  │  • Gerencia ciclo de vida Worker │──── start/stop/restart ────┐      │
│  │  • Aplica updates Agent+Monitor  │                            │      │
│  │  • Realtime Shell (WebSocket)    │                            │      │
│  │  • Wake Listener (Supabase RT)   │                            │      │
│  │  • Graceful shutdown (SIGTERM)   │                            │      │
│  │  • Boot-time dependency check    │                            │      │
│  └──────────────────────────────────┘                            │      │
│                                                                  ▼      │
│  ┌──────────────────────────────────┐                                   │
│  │  iscope-agent (systemd)          │                                   │
│  │  main.py → agent/scheduler.py    │                                   │
│  │                                  │                                   │
│  │  • Processa tarefas de coleta    │                                   │
│  │  • Executa blueprints/executores │                                   │
│  │  • Cross-update do Supervisor    │                                   │
│  │  • Exponential backoff           │                                   │
│  └──────────────────────────────────┘                                   │
│                                                                         │
│  ┌──────────────────────────────────┐                                   │
│  │  iscope-monitor (systemd)        │                                   │
│  │  monitor/main.py                 │                                   │
│  │                                  │                                   │
│  │  • Coleta métricas do servidor   │                                   │
│  │  • CPU, RAM, disco, rede, load   │                                   │
│  │  • Envia para /agent-metrics     │                                   │
│  │  • Log rotation (RotatingFile)   │                                   │
│  └──────────────────────────────────┘                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Responsabilidades por Processo

| Processo | Serviço systemd | Entry Point | Responsabilidade |
|----------|----------------|-------------|------------------|
| **Supervisor** | `iscope-supervisor` | `supervisor/main.py` | Heartbeats, lifecycle do Worker, updates (Agent + Monitor), Realtime Shell, wake listener |
| **Worker** | `iscope-agent` | `main.py` | Execução de tarefas, blueprints, cross-update do Supervisor |
| **Monitor** | `iscope-monitor` | `monitor/main.py` | Coleta e envio de métricas do servidor |

---

## Pré-requisitos

| Requisito | Detalhes |
|-----------|----------|
| **Python** | >= 3.9 (obrigatório) |
| **Sistema** | Linux com systemd |
| **Rede** | Acesso HTTPS aos endpoints do backend |
| **Amass** | Instalado automaticamente pelo script |
| **PowerShell Core** | Instalado automaticamente (necessário para M365) |
| **nmap** | Obrigatório para discovery e fingerprinting de portas |
| **httpx** | [projectdiscovery/httpx](https://github.com/projectdiscovery/httpx) — fingerprinting web |
| **masscan** | Opcional — descoberta rápida de portas (alternativa ao nmap discovery) |

### Sistemas Operacionais Suportados

- Ubuntu 20.04+ / Debian 10+
- RHEL 8/9
- CentOS Stream 8/9
- CentOS Linux 8 (EOL - usa vault repos)
- Oracle Linux 8/9

---

## Instalação Automática (Produção)

O método recomendado para ambientes de produção:

```bash
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "XXXX-XXXX-XXXX-XXXX"
```

O script automaticamente:
- Instala dependências do sistema (Python 3.9+, pip, venv, Amass)
- Cria usuário `iscope` dedicado
- Configura diretórios com permissões corretas
- Instala o agent, supervisor e monitor com dependências Python
- Configura e inicia os 3 serviços systemd
- Instala componentes M365 (PowerShell, módulos, certificado) quando solicitado

---

## Opções do Script de Instalação

| Flag | Descrição | Padrão |
|------|-----------|--------|
| `--activation-code` | Código de ativação único (obrigatório na instalação) | - |
| `--version` | Versão específica para instalar | latest |
| `--poll-interval` | Intervalo de heartbeat em segundos | 60 |
| `--install-dir` | Diretório de instalação do agent | /opt/iscope-agent |
| `--config-dir` | Diretório de configuração | /etc/iscope-agent |
| `--state-dir` | Diretório de estado persistente | /var/lib/iscope-agent |
| `--update` | Reinstalar/atualizar agent existente | - |
| `--uninstall` | Remover completamente o agent | - |

### Exemplos

```bash
# Instalação padrão
curl -fsSL .../agent-install | sudo bash -s -- --activation-code "ABCD-1234-EFGH-5678"

# Instalação com intervalo customizado
curl -fsSL .../agent-install | sudo bash -s -- \
  --activation-code "ABCD-1234-EFGH-5678" \
  --poll-interval 120

# Atualização do agent
curl -fsSL .../agent-install | sudo bash -s -- --update

# Desinstalação completa
curl -fsSL .../agent-install | sudo bash -s -- --uninstall
```

---

## Instalação Manual (Desenvolvimento)

Para ambiente de desenvolvimento local:

```bash
# Clonar/acessar o diretório
cd python-agent

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Configurar ambiente
cp .env.example .env
# Editar .env com suas configurações

# Criar diretórios necessários
mkdir -p storage logs

# Inicializar estado
echo '{"agent_id": null, "access_token": null, "refresh_token": null}' > storage/state.json
```

---

## Configuração

### Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `AGENT_API_BASE_URL` | URL base das Edge Functions | `https://xxx.supabase.co/functions/v1` |
| `AGENT_POLL_INTERVAL` | Intervalo de heartbeat do Worker (segundos) | `60` |
| `AGENT_STATE_FILE` | Caminho do arquivo de estado | `/var/lib/iscope-agent/state.json` |
| `AGENT_ACTIVATION_CODE` | Código de ativação único | `XXXX-XXXX-XXXX-XXXX` |
| `SUPABASE_URL` | URL do projeto Supabase (para Realtime) | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Chave anon do Supabase (para Realtime) | `eyJ...` |
| `SUPERVISOR_HEARTBEAT_INTERVAL` | Intervalo de heartbeat do Supervisor (segundos) | `120` |
| `MONITOR_INTERVAL` | Intervalo de coleta do Monitor (segundos) | `300` |

### Diretórios Padrão (Produção)

| Diretório | Propósito |
|-----------|-----------|
| `/opt/iscope-agent` | Código-fonte (agent/, supervisor/, monitor/) |
| `/etc/iscope-agent` | Configuração (`agent.env`) |
| `/var/lib/iscope-agent` | Estado persistente (`state.json`) |
| `/var/lib/iscope-agent/certs` | Certificados M365 (CRT, KEY, PFX, thumbprint) |
| `/var/log/iscope-agent` | Logs com rotação |

---

## Execução / systemd

O sistema opera com **3 serviços systemd independentes**:

### Comandos por Serviço

```bash
# ── Supervisor (processo principal, gerencia Worker) ──
sudo systemctl status iscope-supervisor
sudo systemctl restart iscope-supervisor
sudo journalctl -u iscope-supervisor -f

# ── Worker (execução de tarefas) ──
sudo systemctl status iscope-agent
sudo systemctl restart iscope-agent
sudo journalctl -u iscope-agent -f

# ── Monitor (métricas do servidor) ──
sudo systemctl status iscope-monitor
sudo systemctl restart iscope-monitor
sudo journalctl -u iscope-monitor -f

# ── Todos os serviços ──
sudo systemctl status iscope-supervisor iscope-agent iscope-monitor
sudo journalctl -u iscope-supervisor -u iscope-agent -u iscope-monitor -f
```

### Execução Manual (Desenvolvimento)

```bash
# Worker
python main.py

# Worker com reset de estado
python main.py --reset-default

# Supervisor (requer agent/ instalado)
python -m supervisor.main

# Monitor
python -m monitor.main
```

---

## Supervisor

O Supervisor (`supervisor/main.py`) é o processo central que orquestra todo o sistema.

### Funcionalidades

#### 1. Heartbeats com o Backend
- Envia heartbeats periódicos para `/agent-heartbeat`
- Reporta versões atuais dos 3 módulos (agent, supervisor, monitor)
- Recebe sinais de update, comandos remotos e flags de componentes

#### 2. Gerenciamento do Worker
- Inicia o Worker via `systemctl start iscope-agent` no boot
- Monitora se o Worker está rodando (`is_running()`)
- Reinicia automaticamente se o Worker parar inesperadamente
- Para o Worker antes de aplicar updates (`stop → update → start`)

#### 3. Aplicação de Updates (Agent + Monitor)
- Recebe sinal `update_available` / `monitor_update_available` no heartbeat
- Download do tarball via signed URL do bucket `agent-releases`
- Validação de checksum SHA256
- Backup do módulo atual → extração do novo → restart do serviço
- Rollback automático em caso de falha

#### 4. Realtime Shell (WebSocket)
- Sessão interativa de shell remoto via Supabase Realtime (WebSocket)
- Ativação sob demanda via heartbeat (`start_realtime: true`) ou wake event
- Timeout por inatividade (120s) ou encerramento via GUI
- O shell é criado/destruído conforme necessidade (não permanente)

#### 5. Wake Listener (Supabase Realtime)
- Listener permanente e leve que escuta eventos `wake` via Supabase Realtime
- Quando recebe um wake event, instancia o RealtimeShell instantaneamente
- Evita esperar pelo próximo heartbeat para iniciar sessão shell

#### 6. Cross-Update do Supervisor
- O Supervisor não atualiza a si mesmo (deadlock)
- Fluxo: Backend sinaliza → Supervisor escreve `pending_supervisor_update.json` → Worker detecta, baixa, aplica e cria `supervisor_restart.flag` → Supervisor detecta a flag e faz `sys.exit(0)` → systemd reinicia com a nova versão

#### 7. Graceful Shutdown (SIGTERM)
- Captura SIGTERM e SIGINT via `signal.signal()`
- Seta `shutdown_requested` event → loop principal encerra
- Para Wake Listener e Realtime Shell antes de sair

#### 8. Boot-time Dependency Check
- Na inicialização, verifica `requirements.txt` e instala dependências faltantes via `pip install -q`
- Garante que o Worker terá todas as dependências ao iniciar

### Bootstrap com Rollback

O `supervisor_bootstrap.sh` é executado como `ExecStartPre` no serviço systemd:

```
┌─────────────────────────────────────────────────────────────┐
│  SUPERVISOR BOOTSTRAP (ExecStartPre)                         │
├─────────────────────────────────────────────────────────────┤
│  1. Verifica se supervisor/main.py existe                    │
│  2. Verifica se venv/bin/python funciona                     │
│  3. Testa import do módulo supervisor                        │
│  4. Se falha → Busca backup e restaura automaticamente       │
│  5. Se rollback falha → Tenta baixar versão latest           │
│  6. Se tudo falha → Loga erro e desiste                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Monitor

O Monitor (`monitor/main.py`) é um serviço independente que coleta métricas do servidor.

### Métricas Coletadas

| Métrica | Descrição |
|---------|-----------|
| `cpu_percent` | Uso de CPU (%) |
| `cpu_count` | Número de cores |
| `ram_total_mb` / `ram_used_mb` / `ram_percent` | Uso de memória RAM |
| `disk_total_gb` / `disk_used_gb` / `disk_percent` | Uso de disco |
| `disk_partitions` | Lista de partições montadas |
| `net_bytes_sent` / `net_bytes_recv` | Tráfego de rede |
| `load_avg_1m` / `load_avg_5m` / `load_avg_15m` | Load average |
| `uptime_seconds` | Tempo de atividade do servidor |
| `process_count` | Número de processos |
| `hostname` / `os_info` | Identificação do servidor |

### Características

- **Intervalo configurável**: Padrão 300s via `MONITOR_INTERVAL`
- **Log rotation**: Usa `RotatingFileHandler` para evitar crescimento indefinido de logs
- **Serviço independente**: Não depende do Worker ou Supervisor para operar
- **Envio via API**: POST para `/agent-metrics` com autenticação JWT

---

## Fluxo de Autenticação

```
┌─────────────────────────────────────────────────────────────┐
│                    INICIALIZAÇÃO                            │
├─────────────────────────────────────────────────────────────┤
│  1. Carrega state.json                                      │
│  2. Verifica se agent_id existe                             │
│     ├─ NÃO → Chama /register-agent com activation_code      │
│     └─ SIM → Continua                                       │
│  3. Verifica se access_token é válido (exp > now)           │
│     ├─ NÃO → Chama /agent-refresh com refresh_token         │
│     └─ SIM → Continua                                       │
│  4. Entra no loop de heartbeat                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    LOOP PRINCIPAL (Supervisor)               │
├─────────────────────────────────────────────────────────────┤
│  1. Envia heartbeat para /agent-heartbeat                    │
│  2. Verifica resposta:                                      │
│     ├─ update_available → Aplica update do Agent             │
│     ├─ supervisor_update_available → Sinaliza para Worker    │
│     ├─ monitor_update_available → Aplica update do Monitor   │
│     ├─ check_components → Verifica componentes do sistema    │
│     ├─ has_pending_commands → Executa comandos remotos       │
│     ├─ start_realtime → Inicia/para Realtime Shell           │
│     └─ next_heartbeat_in → Aguarda intervalo                 │
│  3. Verifica wake events (instantâneo)                       │
│  4. Monitora saúde do Worker                                 │
│  5. Repete                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Endpoints Utilizados

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/register-agent` | POST | Registro inicial com activation code |
| `/agent-heartbeat` | POST | Heartbeat periódico com status e versões |
| `/agent-refresh` | POST | Renovação de access token |
| `/agent-tasks` | GET | Buscar tarefas pendentes |
| `/agent-step-result` | POST | Upload progressivo de cada step |
| `/agent-task-result` | POST | Reportar conclusão final de tarefa |
| `/agent-metrics` | POST | Envio de métricas do servidor (Monitor) |

---

## Sistema de Tarefas

O Worker processa tarefas atribuídas pela plataforma em um modelo de execução por steps:

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE EXECUÇÃO DE TAREFA                                │
├─────────────────────────────────────────────────────────────┤
│  1. GET /agent-tasks → Recebe lista de tarefas              │
│  2. Para cada tarefa:                                       │
│     a. Marca como "running"                                 │
│     b. Executa steps sequencialmente                        │
│     c. POST /agent-step-result após cada step               │
│     d. POST /agent-task-result ao finalizar                 │
│  3. Próximo heartbeat                                       │
└─────────────────────────────────────────────────────────────┘
```

### Tipos de Tarefa

| Tipo | Descrição |
|------|-----------|
| `fortigate_compliance` | Verificações de compliance em FortiGate |
| `fortigate_cve` | Verificação de CVEs no firmware |
| `external_domain_analysis` | Análise de domínio externo |
| `ssh_command` | Execução de comandos via SSH |
| `snmp_query` | Queries SNMP em dispositivos |
| `m365_powershell` | Comandos PowerShell para Exchange Online e Microsoft Graph |
| `attack_surface_scan` | Pipeline completo de attack surface (Super Agent) — executa ASN classification, port discovery, fingerprinting e web probing sequencialmente |

---

## Módulos/Executores

O agent possui **13 executores** implementados para diferentes tipos de coleta:

| Executor | Descrição | Dependência |
|----------|-----------|-------------|
| `http_request` | Requisições HTTP genéricas com interpolação de variáveis | requests |
| `http_session` | APIs com autenticação por sessão/cookies | requests |
| `ssh` | Execução de comandos via SSH | paramiko |
| `snmp` | Queries SNMP (GET, WALK, BULK) | pysnmp |
| `dns_query` | Queries DNS (NS, MX, SOA, SPF, DMARC, DKIM, DNSSEC) | dnspython |
| `domain_whois` | Consulta WHOIS de domínios (registrar, expiração, status) | stdlib (socket) |
| `amass` | Enumeração de subdomínios via OWASP Amass | amass (CLI) |
| `powershell` | Comandos M365 via PowerShell Core (Exchange Online, Microsoft Graph) | pwsh + módulos |
| `masscan` | Descoberta rápida de portas TCP (alternativa ao nmap discovery) | masscan (CLI) |
| `nmap_discovery` | Descoberta de portas TCP em 2 fases com detecção de CDN | nmap (CLI) |
| `nmap` | Fingerprinting de serviços com modelo de 2 fases e scripts NSE | nmap (CLI) |
| `httpx` | Fingerprinting web (tecnologias, TLS, status codes) com modo CDN-aware | httpx (CLI) |
| `asn_classifier` | Classificação de IP por ASN/provedor via WHOIS + RDAP | nenhuma (stdlib) |

### Detalhes dos Executores

#### HTTP Request
- Suporta GET, POST, PUT, DELETE
- Interpolação de variáveis: `{{variable}}` (com suporte a dot notation)
- Headers customizáveis
- Timeout configurável

#### HTTP Session
- Mantém cookies entre requisições
- Autenticação via login form
- Ideal para APIs que requerem sessão

#### SSH Command
- Conexão via chave ou senha
- Timeout por comando
- Captura stdout e stderr

#### SNMP Query
- SNMPv2c e SNMPv3
- Operações: GET, WALK, BULK
- Suporte a múltiplos OIDs

#### DNS Query
- Records: A, AAAA, NS, MX, TXT, SOA, CNAME
- Verificações: SPF, DMARC, DKIM
- Validação DNSSEC

#### Domain WHOIS
- Consulta WHOIS via socket TCP (porta 43)
- Extrai: registrar, data de criação, data de expiração, status do domínio
- Detecção automática do servidor WHOIS por TLD
- Sem dependências externas (usa stdlib)

#### Amass
- Enumeração passiva de subdomínios
- Integração com APIs externas
- Output em formato estruturado

#### PowerShell (M365)
- **Módulos suportados**: Exchange Online Management, Microsoft Graph Authentication
- **Autenticação**: Certificate-Based Authentication (CBA) ou credenciais
- Execução de comandos arbitrários com captura de resultados em JSON
- Suporte a múltiplos comandos por execução com isolamento de erros
- Timeout configurável (padrão: 300s)
- Certificado auto-assinado RSA-2048 gerenciado automaticamente

#### ASN Classifier
- **Fase**: Phase 0 do pipeline de attack surface
- Classificação de IP por ASN/provedor via WHOIS socket (TCP porta 43)
- Enriquecimento via RDAP (IANA bootstrap + fallbacks para ARIN, RIPE, APNIC, LACNIC)
- Identifica 12 provedores CDN/Cloud: Cloudflare, Akamai, Fastly, AWS CloudFront, AWS, Azure, Google Cloud, Incapsula/Imperva, Sucuri, StackPath, Limelight, OVH
- Distingue entre CDN edge (proxy reverso) e cloud hosting genérico
- Retorna: `ip`, `is_cdn`, `provider`, `asn`, `org`, `country`, `abuse_email`, `tech_email`, `ip_range`
- Sem dependências externas (usa stdlib: `socket`, `urllib`, `ssl`)

#### Nmap Discovery (Descoberta de Portas)
- **Fases**: 2 fases sequenciais
  - **Phase 1** — Baseline rápido: `--top-ports 2000` (~30s) para confirmar responsividade do host
  - **Phase 2** — Full range: `1-65535` com rate otimizado (`--min-rate 800`, `--max-rate 1500`, `--defeat-rst-ratelimit`) (~2-4 min)
- Usa `-sS` (SYN stealth) por padrão com fallback automático para `-sT` (TCP connect) se permissão negada
- **CDN-aware**: se `is_cdn=true` no contexto (via ASN Classifier), pula o scan e retorna 14 portas web padrão (80, 443, 8080, 8443, 2052-2096, etc.)
- Se Phase 1 encontra 0 portas, pula Phase 2 (host unresponsive)
- Se Phase 2 falha, retorna resultados parciais do Phase 1
- Parâmetros RTT otimizados: `--initial-rtt-timeout 150ms`, `--max-rtt-timeout 400ms`
- Retorna formato compatível com masscan: `{data: {ip, ports}}`

#### Nmap Fingerprint (Fingerprinting de Serviços)
- **Fases**: 2 fases sequenciais
  - **Phase 1** — Scan principal: `-sT -Pn -sV` com `--version-intensity 5`, scripts NSE pré-calculados por porta (`PORT_SCRIPTS`) + scripts globais (`banner`, `ssl-cert`, `vulners`)
  - **Phase 2** — Enriquecimento condicional: apenas para portas "exóticas" (não cobertas por `PORT_SCRIPTS`) onde `-sV` identificou o serviço — aplica scripts do `SERVICE_SCRIPTS` baseado no nome do serviço
- Limite de 100 portas por scan para evitar timeouts excessivos
- Fallback: se Phase 1 não obtém fingerprints, re-executa com `--version-intensity 3` e apenas `--script=banner`
- Extrai: `port`, `protocol`, `product`, `version`, `cpe`, `scripts` (output NSE), `os` (detecção de OS)

##### Scripts NSE por Porta (PORT_SCRIPTS)

| Porta(s) | Scripts |
|----------|---------|
| 21 (FTP) | `ftp-anon`, `ftp-syst`, `ftp-bounce` |
| 22 (SSH) | `ssh-hostkey`, `ssh2-enum-algos` |
| 25, 587 (SMTP) | `smtp-commands`, `smtp-ntlm-info`, `smtp-open-relay` |
| 53 (DNS) | `dns-zone-transfer` |
| 80, 8080 (HTTP) | `http-title`, `http-server-header`, `http-headers`, `http-security-headers`, `http-methods`, `http-robots.txt` |
| 161 (SNMP) | `snmp-info`, `snmp-sysdescr`, `snmp-brute` |
| 389 (LDAP) | `ldap-rootdse` |
| 443, 8443 (HTTPS) | `http-title`, `http-server-header`, `http-headers`, `ssl-cert`, `ssl-enum-ciphers`, `ssl-heartbleed`, `ssl-poodle`, `http-security-headers`, `http-methods`, `http-robots.txt` |
| 445 (SMB) | `smb-os-discovery`, `smb-protocols`, `smb-security-mode`, `smb-vuln-ms17-010` |
| 636 (LDAPS) | `ldap-rootdse`, `ssl-enum-ciphers`, `ssl-heartbleed` |
| 1433 (MSSQL) | `ms-sql-info`, `ms-sql-ntlm-info` |
| 3306 (MySQL) | `mysql-info`, `mysql-empty-password` |
| 3389 (RDP) | `rdp-ntlm-info`, `rdp-enum-encryption`, `rdp-vuln-ms12-020` |
| 5432 (PostgreSQL) | `pgsql-info` |
| 6379 (Redis) | `redis-info` |
| 27017 (MongoDB) | `mongodb-info` |

##### Scripts NSE por Serviço (SERVICE_SCRIPTS) — Phase 2

Usados para portas exóticas onde `-sV` identificou o serviço mas a porta não está no `PORT_SCRIPTS`:

| Serviço | Scripts |
|---------|---------|
| `http` | `http-title`, `http-server-header`, `http-headers`, `http-security-headers`, `http-methods`, `http-robots.txt` |
| `https` / `ssl` | `ssl-cert`, `ssl-enum-ciphers`, `ssl-heartbleed`, `ssl-poodle` + scripts HTTP |
| `ssh` | `ssh-hostkey`, `ssh2-enum-algos` |
| `ftp` | `ftp-anon`, `ftp-syst`, `ftp-bounce` |
| `smtp` | `smtp-commands`, `smtp-ntlm-info`, `smtp-open-relay` |
| `snmp` | `snmp-info`, `snmp-sysdescr`, `snmp-brute` |
| `ldap` | `ldap-rootdse` |
| `smb` | `smb-os-discovery`, `smb-protocols`, `smb-security-mode`, `smb-vuln-ms17-010` |
| `ms-sql-s` | `ms-sql-info`, `ms-sql-ntlm-info` |
| `mysql` | `mysql-info`, `mysql-empty-password` |
| `ms-wbt-server` (RDP) | `rdp-ntlm-info`, `rdp-enum-encryption`, `rdp-vuln-ms12-020` |
| `postgresql` | `pgsql-info` |
| `redis` | `redis-info` |
| `mongodb` | `mongodb-info` |
| `domain` (DNS) | `dns-zone-transfer` |

##### Scripts Globais (incluídos em todo scan Phase 1)

`banner`, `ssl-cert`, `vulners`

#### Masscan (Descoberta Rápida de Portas)
- Alternativa ao nmap discovery para scan rápido de todas as 65535 portas
- Rate configurável (padrão: 1000 pps)
- Tolerante a timeout: extrai resultados parciais se o scan exceder o tempo limite
- Parsing robusto do JSON malformado do masscan (trailing commas, etc.)
- Retorna formato idêntico ao nmap discovery: `{data: {ip, ports}}`

#### httpx (Fingerprinting Web)
- Sonda HTTP/HTTPS em portas abertas descobertas pelo nmap/masscan
- Detecta: tecnologias web (`-tech-detect`), status codes, títulos, servidor, TLS (versão, cipher, CN, issuer, validade)
- **CDN-aware**: injeta headers de browser realistas (User-Agent Chrome, Accept, etc.) quando `is_cdn=true` no contexto
- Limite de 200 portas por scan para evitar "Argument list too long"
- Prioriza portas web conhecidas (80, 443, 8080, 8443, 3000, 5000, 9090) quando excede o limite
- Retorna: `url`, `status_code`, `title`, `server`, `technologies`, `tls`

---

## Pipeline de Attack Surface

O Super Agent executa um pipeline sequencial de 5 fases para mapear a superfície de ataque de um IP:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE DE ATTACK SURFACE SCANNING                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 0: ASN Classifier                                                    │
│  ├─ WHOIS lookup (TCP socket porta 43) + RDAP (HTTPS)                       │
│  ├─ Identifica provedor (Cloudflare, Akamai, AWS, etc.)                     │
│  ├─ Classifica: is_cdn=true (edge proxy) ou false (hosting direto)          │
│  └─ Output: provider, asn, org, country, is_cdn                            │
│                                                                             │
│  Phase 1: Nmap Discovery — Baseline (top-ports 2000)                        │
│  ├─ Scan rápido ~30s para confirmar responsividade                          │
│  ├─ Se CDN: retorna portas web padrão sem scan                              │
│  └─ Se 0 portas: para aqui (host unresponsive)                              │
│                                                                             │
│  Phase 2: Nmap Discovery — Full Range (1-65535)                             │
│  ├─ Scan completo com rate otimizado ~2-4min                                │
│  ├─ Merge com Phase 1 (union de portas únicas)                              │
│  └─ Se falha: retorna apenas Phase 1                                        │
│                                                                             │
│  Phase 3: Nmap Fingerprint — Main Scan + Exotic Enrichment                  │
│  ├─ -sV com scripts NSE contextuais por porta                               │
│  ├─ Scripts globais: banner, ssl-cert, vulners                              │
│  ├─ Fallback: se sem fingerprints → re-scan com intensity=3                 │
│  └─ Phase 2 condicional: scripts extras para portas exóticas                │
│                                                                             │
│  Phase 4: httpx — Web Fingerprinting                                        │
│  ├─ Sonda HTTP/HTTPS em portas abertas                                      │
│  ├─ Detecta tecnologias, TLS, status codes                                  │
│  └─ CDN-aware: headers de browser realistas                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Comportamento CDN-Aware

Quando o ASN Classifier identifica um IP como CDN edge (Cloudflare, Akamai, etc.):

1. **Nmap Discovery** pula o scan e retorna 14 portas web padrão
2. **Nmap Fingerprint** executa normalmente nas portas retornadas
3. **httpx** injeta headers de browser realistas para evitar bloqueio por WAF

Isso evita scans demorados e improdutivos em IPs de CDN que apenas fazem proxy reverso.

---

## Gerenciamento de Componentes

O agent possui um sistema de gerenciamento automático de componentes do sistema, acionado pelo backend via heartbeat (`check_components`).

### Componentes Gerenciados

| Componente | Descrição | Verificação |
|-----------|-----------|-------------|
| **PowerShell Core 7.x** | Runtime para comandos M365 | `which pwsh` |
| **ExchangeOnlineManagement** | Módulo PowerShell para Exchange | `Get-Module -ListAvailable` |
| **Microsoft.Graph.Authentication** | Módulo PowerShell para Graph API | `Get-Module -ListAvailable` |
| **Certificado M365** | Certificado auto-assinado RSA-2048 para CBA | Verifica existência e validade |

### Fluxo de Verificação

```
┌─────────────────────────────────────────────────────────────┐
│  VERIFICAÇÃO DE COMPONENTES                                  │
├─────────────────────────────────────────────────────────────┤
│  1. Backend envia check_components=true no heartbeat         │
│  2. Supervisor executa ensure_system_components()            │
│  3. Script instala componentes ausentes                     │
│  4. Supervisor reinicia Worker                               │
│  5. Flag check_components.flag é verificada no boot          │
└─────────────────────────────────────────────────────────────┘
```

### Certificado M365

O certificado é gerado automaticamente e armazenado em `/var/lib/iscope-agent/certs/`:

| Arquivo | Descrição | Permissões |
|---------|-----------|------------|
| `m365.crt` | Certificado público (PEM) | 644 |
| `m365.key` | Chave privada (PEM) | 600 |
| `m365.pfx` | Bundle PKCS#12 (para PowerShell) | 600 |
| `thumbprint.txt` | SHA1 fingerprint (formato Azure, sem dois-pontos) | 644 |

---

## Sistema de Auto-Update

O sistema de auto-update opera em 3 fluxos independentes, todos coordenados via heartbeat:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  FLUXO DE AUTO-UPDATE (3 módulos)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ AGENT UPDATE (Supervisor aplica) ─────────────────────────────┐     │
│  │  1. Heartbeat retorna update_available=true + update_info       │     │
│  │  2. Supervisor para o Worker (systemctl stop iscope-agent)      │     │
│  │  3. Download tarball → Verifica SHA256 → Backup → Extrai        │     │
│  │  4. Preserva: venv, logs, .env, storage                        │     │
│  │  5. Reinicia Worker (systemctl start iscope-agent)              │     │
│  │  6. Se falha → Rollback automático do backup                    │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ SUPERVISOR UPDATE (cross-update via Worker) ──────────────────┐     │
│  │  1. Heartbeat retorna supervisor_update_available=true          │     │
│  │  2. Supervisor escreve pending_supervisor_update.json           │     │
│  │  3. Worker detecta o arquivo, baixa tarball, valida, aplica     │     │
│  │  4. Worker cria supervisor_restart.flag                         │     │
│  │  5. Supervisor detecta flag → sys.exit(0)                       │     │
│  │  6. systemd reinicia Supervisor com a nova versão               │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ MONITOR UPDATE (Supervisor aplica) ───────────────────────────┐     │
│  │  1. Heartbeat retorna monitor_update_available=true             │     │
│  │  2. Supervisor baixa tarball → SHA256 → Substitui monitor/      │     │
│  │  3. Reinicia serviço (systemctl restart iscope-monitor)         │     │
│  └─────────────────────────────────────────────────────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Versões e Controle

O backend armazena as versões alvo em `system_settings`:

| Setting | Descrição |
|---------|-----------|
| `agent_latest_version` | Versão alvo do Agent (Worker) |
| `agent_update_checksum` | SHA256 do tarball do Agent |
| `supervisor_latest_version` | Versão alvo do Supervisor |
| `supervisor_update_checksum` | SHA256 do tarball do Supervisor |
| `monitor_latest_version` | Versão alvo do Monitor |
| `monitor_update_checksum` | SHA256 do tarball do Monitor |

O heartbeat compara as versões reportadas pelo agent com as versões em `system_settings` e sinaliza updates quando há diferença.

### Características

- **Verificação de integridade**: SHA256 case-insensitive
- **Preservação de dados**: venv, storage, logs, .env não são sobrescritos
- **Backup automático**: Criado antes de cada atualização
- **Rollback**: Restauração automática em caso de falha
- **Instalação fresh**: Se o módulo não existe em disco (ex: agent/ ausente), o update funciona como instalação inicial
- **Tempfile seguro**: Downloads usam `tempfile.mkdtemp()` em vez de paths fixos para evitar conflitos

---

## Scheduler com Exponential Backoff

O loop principal do Worker (`scheduler.py`) implementa um scheduler com backoff exponencial para resiliência:

- **Intervalo base**: configurável (padrão: 60s via `AGENT_POLL_INTERVAL`)
- **Backoff exponencial**: em caso de erro, o intervalo dobra a cada falha consecutiva (`base × 2^erros`)
- **Intervalo máximo**: 300s (5 minutos) — cap para evitar intervalos excessivos
- **Reset automático**: após uma operação bem-sucedida, o intervalo volta ao base
- **Intervalo do servidor**: se o heartbeat retornar um intervalo específico, o scheduler o utiliza (mínimo 10s)

Exemplo de progressão com base=120s:
```
Sucesso:  120s → 120s → 120s
Erro #1:  240s
Erro #2:  300s (capped)
Erro #3:  300s (capped)
Sucesso:  120s (reset)
```

---

## Recuperação (agent-fix)

Para agents que não conseguem se atualizar automaticamente, estão em crash loop, ou possuem dependências corrompidas, existe a Edge Function `agent-fix`:

```bash
curl -sS https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-fix | sudo bash
```

### O que o agent-fix faz

1. **Preserva configuração**: Detecta e preserva `.env` de múltiplos caminhos (`/opt/iscope-agent/.env`, `/etc/iscope-agent/agent.env`)
2. **Baixa módulos latest**: Download dos tarballs mais recentes (Agent, Supervisor, Monitor) via signed URLs
3. **Reconstrói venv**: Deleta e recria o ambiente virtual, instala `requirements.txt`
4. **Limpa flags**: Remove `supervisor_restart.flag`, `rollback.flag`, `pending_supervisor_update.json`
5. **Recria systemd units**: Se ausentes, recria os 3 arquivos `.service`
6. **Reinicia serviços**: Restart dos 3 serviços (Supervisor, Worker, Monitor)

### Quando usar

- Agent offline e sem resposta ao heartbeat
- Crash loop do Supervisor ou Worker
- Dependências Python corrompidas ou faltantes (ex: `websocket-client`)
- Versão muito antiga que não suporta o protocolo de auto-update atual
- Módulos ausentes em disco (agent/, supervisor/, monitor/)

---

## Compatibilidade de Sistemas

### Ubuntu/Debian
```bash
# Gerenciador de pacotes
apt-get update && apt-get install -y python3.9 python3.9-venv python3-pip
```

### RHEL 8/9, CentOS Stream 8
```bash
# Ativa módulos necessários
dnf module reset python39 -y
dnf module enable python39 -y
dnf install -y python39 python39-pip
```

### CentOS Linux 8 (EOL)
O script automaticamente configura os repositórios vault:
```bash
# Redireciona para vault.centos.org
sed -i 's/mirrorlist/#mirrorlist/g' /etc/yum.repos.d/CentOS-*.repo
sed -i 's|#baseurl=http://mirror.centos.org|baseurl=http://vault.centos.org|g' /etc/yum.repos.d/CentOS-*.repo
```

### Oracle Linux 8/9
```bash
# Usa repositórios padrão Oracle
dnf install -y python39 python39-pip
```

---

## Estrutura de Arquivos

```
python-agent/
├── main.py                        # Entry point do Worker
├── requirements.txt               # Dependências Python
├── check-deps.sh                  # Verificação de componentes (ExecStartPre)
├── supervisor_bootstrap.sh        # Bootstrap do Supervisor com rollback (ExecStartPre)
├── .env.example                   # Template de configuração
├── README.md                      # Esta documentação
│
├── agent/                         # Módulo Worker (v1.3.14)
│   ├── __init__.py                # Package marker
│   ├── config.py                  # Carregamento de configurações
│   ├── state.py                   # Gerenciamento de estado persistente
│   ├── api_client.py              # Cliente HTTP para backend
│   ├── auth.py                    # Autenticação e renovação de tokens
│   ├── heartbeat.py               # Lógica de heartbeat (shared com Supervisor)
│   ├── heartbeat_worker.py        # Heartbeat específico do Worker
│   ├── tasks.py                   # Orquestrador de tarefas
│   ├── scheduler.py               # Loop principal com exponential backoff
│   ├── logger.py                  # Sistema de logging com rotação
│   ├── updater.py                 # Auto-update com rollback
│   ├── supervisor_updater.py      # Cross-update do Supervisor (chamado pelo Worker)
│   ├── remote_commands.py         # Processamento de comandos remotos
│   ├── realtime_commands.py       # Comandos via Supabase Realtime
│   ├── version.py                 # Versão centralizada (1.3.14)
│   ├── components.py              # Gerenciamento de componentes do sistema
│   └── executors/
│       ├── __init__.py            # Exporta executores
│       ├── base.py                # Classe base abstrata
│       ├── http_request.py        # HTTP genérico
│       ├── http_session.py        # HTTP com sessão
│       ├── ssh.py                 # SSH (paramiko)
│       ├── snmp.py                # SNMP (pysnmp)
│       ├── dns_query.py           # DNS queries
│       ├── domain_whois.py        # WHOIS de domínios
│       ├── amass.py               # Subdomain enumeration
│       ├── powershell.py          # M365 PowerShell (Exchange Online, Microsoft Graph)
│       ├── asn_classifier.py      # Classificação ASN/CDN via WHOIS + RDAP
│       ├── nmap_discovery.py      # Descoberta de portas TCP (2 fases)
│       ├── nmap.py                # Fingerprinting de serviços (2 fases + NSE)
│       ├── masscan.py             # Descoberta rápida de portas (alternativa)
│       └── httpx_executor.py      # Fingerprinting web (tecnologias, TLS)
│
├── supervisor/                    # Módulo Supervisor (v1.2.1)
│   ├── __init__.py
│   ├── main.py                    # Entry point do Supervisor
│   ├── config.py                  # Configurações do Supervisor
│   ├── heartbeat.py               # Loop de heartbeat do Supervisor
│   ├── worker_manager.py          # Gerenciamento do Worker (start/stop/restart)
│   ├── updater.py                 # Aplicação de updates do Agent
│   ├── monitor_updater.py         # Aplicação de updates do Monitor
│   ├── realtime_shell.py          # Shell interativo via WebSocket
│   ├── realtime_listener.py       # Wake listener (Supabase Realtime)
│   ├── logger.py                  # Logger do Supervisor
│   └── version.py                 # Versão centralizada (1.2.1)
│
├── monitor/                       # Módulo Monitor (v1.1.1)
│   ├── __init__.py
│   ├── main.py                    # Entry point do Monitor
│   ├── collector.py               # Coleta de métricas do sistema
│   ├── worker.py                  # Loop de envio de métricas
│   └── version.py                 # Versão centralizada (1.1.1)
│
└── systemd/                       # Templates de serviços systemd
    ├── iscope-agent.service        # Serviço do Worker
    ├── iscope-supervisor.service   # Serviço do Supervisor
    └── iscope-monitor.service      # Serviço do Monitor
```

---

## Tratamento de Erros

| Código do Backend | Ação do Agent |
|-------------------|---------------|
| `TOKEN_EXPIRED` | Chama `/agent-refresh` automaticamente |
| `INVALID_SIGNATURE` | Limpa estado local, para execução |
| `INVALID_TOKEN` | Limpa estado local, para execução |
| `BLOCKED` / `REVOKED` | Para execução com erro crítico |
| `AGENT_STOPPED` | Supervisor para Worker e encerra (exit 1) |

### Resiliência do Supervisor

- **Erros consecutivos**: Após 10 erros consecutivos de heartbeat, reinicia o Worker por precaução
- **Worker inativo**: Se o Worker para inesperadamente, o Supervisor o reinicia automaticamente
- **Bootstrap rollback**: Se o Supervisor falha ao iniciar, `supervisor_bootstrap.sh` restaura backup ou baixa versão latest

---

## Troubleshooting

### Verificar status dos 3 serviços
```bash
sudo systemctl status iscope-supervisor iscope-agent iscope-monitor
```

### Ver logs combinados
```bash
sudo journalctl -u iscope-supervisor -u iscope-agent -u iscope-monitor -f --since "10 min ago"
```

### Verificar versões instaladas
```bash
grep "__version__" /opt/iscope-agent/agent/version.py
grep "__version__" /opt/iscope-agent/supervisor/version.py
grep "__version__" /opt/iscope-agent/monitor/version.py
```

### Agent não registra
```bash
# Verificar código de ativação
cat /etc/iscope-agent/agent.env | grep ACTIVATION_CODE

# Verificar conectividade
curl -I https://akbosdbyheezghieiefz.supabase.co/functions/v1/register-agent

# Ver logs do Supervisor (responsável pelo heartbeat)
sudo journalctl -u iscope-supervisor -n 50
```

### Token inválido após reinício
```bash
# Opção 1: Reset via script
python main.py --reset-default

# Opção 2: Reinstalar com novo código
curl -fsSL .../agent-install | sudo bash -s -- --uninstall
curl -fsSL .../agent-install | sudo bash -s -- --activation-code "NOVO-CODE"
```

### Erros de execução de tarefas
```bash
# Verificar estado atual
cat /var/lib/iscope-agent/state.json | python3 -m json.tool

# Verificar permissões
ls -la /var/lib/iscope-agent/
ls -la /opt/iscope-agent/

# Verificar logs do Worker
sudo journalctl -u iscope-agent -n 100
```

### Supervisor em crash loop
```bash
# Verificar bootstrap
sudo journalctl -u iscope-supervisor | grep "bootstrap"

# Verificar se supervisor/main.py existe
ls -la /opt/iscope-agent/supervisor/main.py

# Verificar venv
/opt/iscope-agent/venv/bin/python -c "import supervisor"

# Se falhar → agent-fix
curl -sS https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-fix | sudo bash
```

### Monitor não envia métricas
```bash
# Verificar serviço
sudo systemctl status iscope-monitor
sudo journalctl -u iscope-monitor -n 50

# Verificar módulo
/opt/iscope-agent/venv/bin/python -c "import monitor; print('OK')"

# Reiniciar
sudo systemctl restart iscope-monitor
```

### Dependências Python faltando
```bash
# Verificar manualmente
/opt/iscope-agent/venv/bin/pip list

# Instalar manualmente
/opt/iscope-agent/venv/bin/pip install -r /opt/iscope-agent/requirements.txt

# Ou usar agent-fix para reconstruir venv
curl -sS https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-fix | sudo bash
```

### Amass não encontrado
```bash
# Verificar instalação
which amass
amass -version

# Reinstalar via script
curl -fsSL .../agent-install | sudo bash -s -- --update
```

### nmap / httpx / masscan não encontrado
```bash
# Verificar instalação
which nmap && nmap --version
which httpx && httpx -version
which masscan && masscan --version

# Instalar nmap (Ubuntu/Debian)
sudo apt install -y nmap

# Instalar httpx (projectdiscovery)
# https://github.com/projectdiscovery/httpx#installation
go install -v github.com/projectdiscovery/httpx/cmd/httpx@latest

# Instalar masscan (opcional)
sudo apt install -y masscan
```

### PowerShell / M365 não funciona
```bash
# Verificar PowerShell
pwsh --version

# Verificar módulos M365
pwsh -Command "Get-Module -ListAvailable ExchangeOnlineManagement, Microsoft.Graph.Authentication"

# Verificar certificado
ls -la /var/lib/iscope-agent/certs/
openssl x509 -in /var/lib/iscope-agent/certs/m365.crt -noout -dates

# Forçar reinstalação de componentes
sudo touch /var/lib/iscope-agent/check_components.flag
sudo systemctl restart iscope-supervisor

# Ver logs de componentes
cat /var/log/iscope-agent/components.log
```

### Recuperação completa (agent-fix)
```bash
# Para agents offline, corrompidos ou com dependências faltando:
curl -sS https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-fix | sudo bash

# O script preserva .env e estado, reconstrói tudo e reinicia os 3 serviços.
```

---

## Dependências Python

```
requests>=2.31.0         # HTTP client
certifi>=2024.2.2        # Certificados SSL
pyjwt>=2.8.0             # JWT handling
python-dotenv>=1.0.1     # Environment variables
schedule>=1.2.1          # Task scheduling
paramiko>=3.4.0          # SSH client
pysnmp>=6.0.0            # SNMP client
urllib3>=1.26.0,<2.0.0   # HTTP utilities (pinned <2.0 para compatibilidade)
dnspython>=2.7.0         # DNS queries
websocket-client>=1.7.0  # WebSocket (Supabase Realtime)
```

---

## Licença

Proprietário — iScope 360 © 2024-2026
