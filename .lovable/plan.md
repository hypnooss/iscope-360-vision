

## Atualizar README.md do Python Agent

### Objetivo

Atualizar a documentação do agent Python com todas as melhorias implementadas, opções do script de instalação, pré-requisitos e módulos desenvolvidos.

---

### Principais Atualizações

| Seção | O que será adicionado |
|-------|----------------------|
| **Versão** | Versão atual: 1.1.1 |
| **Pré-requisitos** | Python >= 3.9 (atualizado de 3.8), systemd, Amass (opcional) |
| **Instalação Automática** | Comando curl \| bash com todas as opções |
| **Opções do Script** | Todas as flags disponíveis (--version, --update, --uninstall, etc.) |
| **Módulos/Executores** | 6 executores implementados (http_request, http_session, ssh, snmp, dns_query, amass) |
| **Auto-Update** | Sistema de atualização automática via heartbeat |
| **Diretórios Padrão** | /opt/iscope-agent, /etc/iscope-agent, /var/lib/iscope-agent |
| **Compatibilidade** | CentOS 8 EOL, CentOS Stream 8, RHEL 8, Ubuntu/Debian |

---

### Conteúdo do README Atualizado

#### 1. Cabeçalho e Versão
- Versão atual: 1.1.1
- Descrição atualizada do projeto

#### 2. Pré-requisitos
- Python >= 3.9 (obrigatório)
- systemd (obrigatório)
- Linux (Ubuntu/Debian, RHEL/CentOS 8+, Oracle Linux)
- Acesso à rede para endpoints do backend
- Amass (instalado automaticamente)

#### 3. Instalação Automática (Produção)
```bash
curl -fsSL https://akbosdbyheezghieiefz.supabase.co/functions/v1/agent-install | sudo bash -s -- --activation-code "XXXX-XXXX-XXXX-XXXX"
```

#### 4. Opções do Script de Instalação
| Flag | Descrição | Padrão |
|------|-----------|--------|
| `--activation-code` | Código de ativação (obrigatório) | - |
| `--version` | Versão específica para instalar | latest |
| `--poll-interval` | Intervalo de heartbeat (segundos) | 60 |
| `--install-dir` | Diretório de instalação | /opt/iscope-agent |
| `--config-dir` | Diretório de configuração | /etc/iscope-agent |
| `--state-dir` | Diretório de estado | /var/lib/iscope-agent |
| `--update` | Reinstalar/atualizar agent existente | - |
| `--uninstall` | Remover completamente o agent | - |

#### 5. Módulos/Executores Desenvolvidos
| Executor | Descrição | Dependência |
|----------|-----------|-------------|
| `http_request` | Requisições HTTP genéricas com interpolação | requests |
| `http_session` | APIs com autenticação por sessão (cookies) | requests |
| `ssh_command` | Execução de comandos via SSH | paramiko |
| `snmp_query` | Queries SNMP (GET, WALK, BULK) | pysnmp |
| `dns_query` | Queries DNS (NS, MX, SOA, SPF, DMARC, DKIM, DNSSEC) | dnspython |
| `amass` | Enumeração de subdomínios via OWASP Amass | amass |

#### 6. Sistema de Auto-Update
- Verificação automática via heartbeat
- Download com verificação de checksum (SHA256)
- Backup automático antes de atualização
- Rollback em caso de falha
- Restart automático via systemd

#### 7. Compatibilidade de Sistemas
- Ubuntu/Debian (apt-get)
- RHEL 8/9, CentOS Stream 8 (dnf)
- CentOS Linux 8 EOL (vault repos)
- Oracle Linux 8/9

#### 8. Endpoints Atualizados
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/register-agent` | POST | Registro inicial |
| `/agent-heartbeat` | POST | Heartbeat periódico |
| `/agent-refresh` | POST | Renovação de token |
| `/agent-tasks` | GET | Buscar tarefas pendentes |
| `/agent-step-result` | POST | Upload progressivo de cada step |
| `/agent-task-result` | POST | Conclusão final de tarefa |

#### 9. Estrutura de Arquivos Atualizada
```
python-agent/
├── main.py               # Entry point
├── requirements.txt      # Dependências
├── .env.example          # Template de configuração
└── agent/
    ├── __init__.py
    ├── config.py         # Configurações
    ├── state.py          # Estado persistente
    ├── api_client.py     # Cliente HTTP
    ├── auth.py           # Autenticação JWT
    ├── heartbeat.py      # Heartbeat com update check
    ├── tasks.py          # Orquestrador de tarefas
    ├── scheduler.py      # Loop principal
    ├── logger.py         # Logging com rotação
    ├── updater.py        # Auto-update com rollback
    ├── version.py        # Versão centralizada
    └── executors/
        ├── base.py           # Classe base abstrata
        ├── http_request.py   # HTTP genérico
        ├── http_session.py   # HTTP com sessão
        ├── ssh.py            # SSH (paramiko)
        ├── snmp.py           # SNMP (pysnmp)
        ├── dns_query.py      # DNS queries
        └── amass.py          # Subdomain enum
```

---

### Detalhes Técnicos

**Arquivo a modificar:** `python-agent/README.md`

O novo README terá aproximadamente 350-400 linhas incluindo:
- Diagrama de fluxo de autenticação (ASCII)
- Tabelas de referência para opções e executores
- Exemplos de comandos de verificação
- Seção de troubleshooting expandida
- Notas de compatibilidade para CentOS 8 EOL

