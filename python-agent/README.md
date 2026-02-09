# iScope 360 — Python Agent

**Versão atual: 1.2.3**

Agent Python para comunicação com o backend do iScope 360. Executa em servidores Linux, envia heartbeats periódicos, processa tarefas de coleta (firewalls, domínios externos, M365 PowerShell) e suporta atualização automática.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Instalação Automática (Produção)](#instalação-automática-produção)
- [Opções do Script de Instalação](#opções-do-script-de-instalação)
- [Instalação Manual (Desenvolvimento)](#instalação-manual-desenvolvimento)
- [Configuração](#configuração)
- [Execução](#execução)
- [Fluxo de Autenticação](#fluxo-de-autenticação)
- [Endpoints Utilizados](#endpoints-utilizados)
- [Sistema de Tarefas](#sistema-de-tarefas)
- [Módulos/Executores](#módulosexecutores)
- [Gerenciamento de Componentes](#gerenciamento-de-componentes)
- [Sistema de Auto-Update](#sistema-de-auto-update)
- [Compatibilidade de Sistemas](#compatibilidade-de-sistemas)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Tratamento de Erros](#tratamento-de-erros)
- [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

| Requisito | Detalhes |
|-----------|----------|
| **Python** | >= 3.9 (obrigatório) |
| **Sistema** | Linux com systemd |
| **Rede** | Acesso HTTPS aos endpoints do backend |
| **Amass** | Instalado automaticamente pelo script |
| **PowerShell Core** | Instalado automaticamente (necessário para M365) |

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
- Instala o agent e dependências Python
- Configura e inicia o serviço systemd
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
| `AGENT_POLL_INTERVAL` | Intervalo de heartbeat (segundos) | `60` |
| `AGENT_STATE_FILE` | Caminho do arquivo de estado | `/var/lib/iscope-agent/state.json` |
| `AGENT_ACTIVATION_CODE` | Código de ativação único | `XXXX-XXXX-XXXX-XXXX` |

### Diretórios Padrão (Produção)

| Diretório | Propósito |
|-----------|-----------|
| `/opt/iscope-agent` | Código-fonte do agent |
| `/etc/iscope-agent` | Configuração (`agent.env`) |
| `/var/lib/iscope-agent` | Estado persistente (`state.json`) |
| `/var/lib/iscope-agent/certs` | Certificados M365 (CRT, KEY, PFX, thumbprint) |
| `/var/log/iscope-agent` | Logs com rotação |

---

## Execução

```bash
# Executar normalmente
python main.py

# Resetar estado do agent (para re-registro)
python main.py --reset-default
```

### Comandos systemd (Produção)

```bash
# Status do serviço
sudo systemctl status iscope-agent

# Reiniciar serviço
sudo systemctl restart iscope-agent

# Ver logs em tempo real
sudo journalctl -u iscope-agent -f

# Logs das últimas 100 linhas
sudo journalctl -u iscope-agent -n 100
```

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
│                    LOOP PRINCIPAL                           │
├─────────────────────────────────────────────────────────────┤
│  1. Envia heartbeat para /agent-heartbeat                   │
│  2. Verifica resposta:                                      │
│     ├─ check_components → Solicita verificação de deps      │
│     ├─ update_available → Executa auto-update               │
│     ├─ has_pending_tasks → Busca e processa tarefas         │
│     └─ next_heartbeat_in → Aguarda intervalo                │
│  3. Repete                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Endpoints Utilizados

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/register-agent` | POST | Registro inicial com activation code |
| `/agent-heartbeat` | POST | Heartbeat periódico com status |
| `/agent-refresh` | POST | Renovação de access token |
| `/agent-tasks` | GET | Buscar tarefas pendentes |
| `/agent-step-result` | POST | Upload progressivo de cada step |
| `/agent-task-result` | POST | Reportar conclusão final de tarefa |

---

## Sistema de Tarefas

O agent processa tarefas atribuídas pela plataforma em um modelo de execução por steps:

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

---

## Módulos/Executores

O agent possui 7 executores implementados para diferentes tipos de coleta:

| Executor | Descrição | Dependência |
|----------|-----------|-------------|
| `http_request` | Requisições HTTP genéricas com interpolação de variáveis | requests |
| `http_session` | APIs com autenticação por sessão/cookies | requests |
| `ssh` | Execução de comandos via SSH | paramiko |
| `snmp` | Queries SNMP (GET, WALK, BULK) | pysnmp |
| `dns_query` | Queries DNS (NS, MX, SOA, SPF, DMARC, DKIM, DNSSEC) | dnspython |
| `amass` | Enumeração de subdomínios via OWASP Amass | amass (CLI) |
| `powershell` | Comandos M365 via PowerShell Core (Exchange Online, Microsoft Graph) | pwsh + módulos |

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
│  2. Agent cria flag em /var/lib/iscope-agent/                │
│  3. Agent solicita restart do serviço via systemd            │
│  4. ExecStartPre executa check-deps.sh (como root)          │
│  5. Script instala componentes ausentes                     │
│  6. Agent reinicia normalmente                              │
└─────────────────────────────────────────────────────────────┘
```

### Certificado M365

O certificado é gerado automaticamente e armazenado em `/var/lib/iscope-agent/certs/`:

| Arquivo | Descrição | Permissões |
|---------|-----------|------------|
| `m365.crt` | Certificado público (PEM) | 644 |
| `m365.key` | Chave privada (PEM) | 600 |
| `m365.pfx` | Bundle PKCS#12 (para PowerShell) | 600 |
| `thumbprint.txt` | SHA1 fingerprint (formato Azure) | 644 |

---

## Sistema de Auto-Update

O agent possui sistema de atualização automática controlado pelo backend:

```
┌─────────────────────────────────────────────────────────────┐
│  FLUXO DE AUTO-UPDATE                                       │
├─────────────────────────────────────────────────────────────┤
│  1. Heartbeat retorna update_available=true                 │
│  2. Verifica se há tarefas pendentes                        │
│     ├─ SIM e não é forçado → Adia update                    │
│     └─ NÃO ou forçado → Continua                            │
│  3. Download do pacote de atualização                       │
│  4. Verifica checksum SHA256                                │
│  5. Cria backup em /var/lib/iscope-agent/backup             │
│  6. Extrai novos arquivos (preserva venv, logs, .env)       │
│  7. Reinicia serviço via systemd                            │
│  8. Em caso de falha → Rollback automático                  │
└─────────────────────────────────────────────────────────────┘
```

### Características

- **Verificação de integridade**: SHA256 case-insensitive
- **Preservação de dados**: venv, storage, logs, .env não são sobrescritos
- **Backup automático**: Criado antes de cada atualização
- **Rollback**: Restauração automática em caso de falha
- **Restart gerenciado**: Via systemd para garantir continuidade

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
├── main.py                   # Entry point
├── requirements.txt          # Dependências Python
├── check-deps.sh             # Script de verificação de componentes (ExecStartPre)
├── .env.example              # Template de configuração
├── README.md                 # Esta documentação
└── agent/
    ├── __init__.py            # Package marker
    ├── config.py              # Carregamento de configurações
    ├── state.py               # Gerenciamento de estado persistente
    ├── api_client.py          # Cliente HTTP para backend
    ├── auth.py                # Autenticação e renovação de tokens
    ├── heartbeat.py           # Lógica de heartbeat
    ├── tasks.py               # Orquestrador de tarefas
    ├── scheduler.py           # Loop principal
    ├── logger.py              # Sistema de logging com rotação
    ├── updater.py             # Auto-update com rollback
    ├── version.py             # Versão centralizada (1.2.3)
    ├── components.py          # Gerenciamento de componentes do sistema
    └── executors/
        ├── __init__.py        # Exporta executores
        ├── base.py            # Classe base abstrata
        ├── http_request.py    # HTTP genérico
        ├── http_session.py    # HTTP com sessão
        ├── ssh.py             # SSH (paramiko)
        ├── snmp.py            # SNMP (pysnmp)
        ├── dns_query.py       # DNS queries
        ├── amass.py           # Subdomain enumeration
        └── powershell.py      # M365 PowerShell (Exchange Online, Microsoft Graph)
```

---

## Tratamento de Erros

| Código do Backend | Ação do Agent |
|-------------------|---------------|
| `TOKEN_EXPIRED` | Chama `/agent-refresh` automaticamente |
| `INVALID_SIGNATURE` | Limpa estado local, para execução |
| `INVALID_TOKEN` | Limpa estado local, para execução |
| `BLOCKED` / `REVOKED` | Para execução com erro crítico |

---

## Troubleshooting

### Agent não registra
```bash
# Verificar código de ativação
cat /etc/iscope-agent/agent.env | grep ACTIVATION_CODE

# Verificar conectividade
curl -I https://akbosdbyheezghieiefz.supabase.co/functions/v1/register-agent

# Ver logs detalhados
sudo journalctl -u iscope-agent -n 50
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

# Testar conectividade SSH (se aplicável)
ssh -o ConnectTimeout=5 user@target-host
```

### Amass não encontrado
```bash
# Verificar instalação
which amass
amass -version

# Reinstalar via script
curl -fsSL .../agent-install | sudo bash -s -- --update
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
sudo systemctl restart iscope-agent

# Ver logs de componentes
cat /var/log/iscope-agent/components.log
```

### Verificar versão instalada
```bash
# Via código Python
grep "__version__" /opt/iscope-agent/agent/version.py

# Via logs
sudo journalctl -u iscope-agent | grep "Agent v"
```

---

## Dependências Python

```
requests>=2.31.0      # HTTP client
certifi>=2024.2.2     # Certificados SSL
pyjwt>=2.8.0          # JWT handling
python-dotenv>=1.0.1  # Environment variables
schedule>=1.2.1       # Task scheduling
paramiko>=3.4.0       # SSH client
pysnmp>=6.0.0         # SNMP client
urllib3>=2.0.0        # HTTP utilities
dnspython>=2.7.0      # DNS queries
```

---

## Licença

Proprietário — iScope 360 © 2024-2025
