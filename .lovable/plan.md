

# Plano: Armazenar e Versionar o Agent Python no Projeto

## Objetivo
Criar uma pasta `python-agent/` no projeto para armazenar todo o código do agent Python, mantendo o contexto unificado com o backend (Edge Functions) e facilitando futuras alterações.

## Estrutura de Arquivos a Criar

```
python-agent/
├── README.md              # Documentação completa do agent
├── requirements.txt       # Dependências Python
├── .env.example          # Template de configuração (sem secrets)
├── main.py               # Entry point do agent
└── agent/
    ├── __init__.py       # Package marker
    ├── config.py         # Carregamento de configurações
    ├── state.py          # Gerenciamento de estado persistente
    ├── api_client.py     # Cliente HTTP para as Edge Functions
    ├── auth.py           # Autenticação (register, refresh)
    ├── heartbeat.py      # Lógica de heartbeat
    ├── scheduler.py      # Loop principal com intervalos dinâmicos
    └── logger.py         # Sistema de logging com rotação
```

## Arquivos a Serem Criados

### 1. `python-agent/README.md`
Documentação completa incluindo:
- Visão geral do agent
- Requisitos (Python 3.8+)
- Instalação e configuração
- Variáveis de ambiente
- Como executar
- Fluxo de autenticação (registro → tokens → refresh)
- Troubleshooting

### 2. `python-agent/.env.example`
Template de configuração sem valores sensíveis:
```
AGENT_API_BASE_URL=https://pgjervwrvmfmwvfvylvj.supabase.co/functions/v1
AGENT_POLL_INTERVAL=60
AGENT_STATE_FILE=storage/state.json
AGENT_ACTIVATION_CODE=XXXX-XXXX-XXXX-XXXX
```

### 3. `python-agent/requirements.txt`
```
requests>=2.31.0
pyjwt>=2.8.0
python-dotenv>=1.0.1
schedule>=1.2.1
```

### 4. `python-agent/main.py`
Entry point com:
- Classe `AgentApp` que orquestra os componentes
- Função `agent_loop()` que executa a cada ciclo
- Comando `--reset-default` para reiniciar estado
- Tratamento de erros e shutdown graceful

### 5. `python-agent/agent/__init__.py`
Arquivo vazio para marcar como package Python

### 6. `python-agent/agent/config.py`
Carregamento de variáveis de ambiente via `python-dotenv`

### 7. `python-agent/agent/state.py`
Classe `AgentState` para:
- Carregar/salvar estado em JSON
- Verificar se está registrado
- Persistir tokens

### 8. `python-agent/agent/api_client.py`
Classe `APIClient` com:
- Métodos `get()` e `post()`
- Headers de autenticação automáticos
- Extração de códigos de erro do backend
- Suporte a `use_refresh_token` para renovação

### 9. `python-agent/agent/auth.py`
Classe `AuthManager` com:
- `register_if_needed()` - Registro via activation code
- `refresh_tokens()` - Renovação do access token
- `is_access_token_valid()` - Validação de expiração
- `ensure_authenticated()` - Fluxo completo

### 10. `python-agent/agent/heartbeat.py`
Classe `AgentHeartbeat` com:
- `send()` - Envio de heartbeat
- Tratamento de erros específicos (TOKEN_EXPIRED, BLOCKED, INVALID_TOKEN)
- Exception `AgentStopped` para parada controlada

### 11. `python-agent/agent/scheduler.py`
Classe `AgentScheduler` com:
- Loop infinito com intervalo dinâmico
- Suporte a `next_heartbeat_in` do backend
- Tratamento de exceções no loop

### 12. `python-agent/agent/logger.py`
Sistema de logging com:
- Rotação de arquivos (1MB, 1 backup)
- Output simultâneo para arquivo e stdout
- Formato padronizado com timestamp

---

## Detalhes Técnicos

### Integração com Edge Functions
O agent se comunica com 3 endpoints:

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/register-agent` | POST | Registro inicial com activation code |
| `/agent-heartbeat` | POST | Heartbeat periódico |
| `/agent-refresh` | POST | Renovação de access token |

### Fluxo de Autenticação

```text
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
```

### Tratamento de Erros

| Código | Ação do Agent |
|--------|---------------|
| `TOKEN_EXPIRED` | Chama `/agent-refresh` |
| `INVALID_SIGNATURE` | Limpa estado, para execução |
| `INVALID_TOKEN` | Limpa estado, para execução |
| `BLOCKED` / `REVOKED` | Para execução com erro crítico |

---

## Benefícios desta Organização

1. **Contexto Unificado**: Todo o código (backend + agent) no mesmo projeto
2. **Versionamento**: Git rastreia alterações do agent junto com as Edge Functions
3. **Documentação**: README.md explica como usar e debugar
4. **Manutenibilidade**: Estrutura modular facilita alterações futuras
5. **Segurança**: `.env.example` sem secrets, `.env` real fica fora do Git

