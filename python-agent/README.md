# InfraScope360 Python Agent

Agent Python para comunicação com o backend do InfraScope360. Executa em servidores Linux e envia heartbeats periódicos para monitoramento.

## Requisitos

- Python 3.8+
- Acesso à rede para endpoints do backend

## Instalação

```bash
# Criar ambiente virtual (recomendado)
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt
```

## Configuração

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Configure as variáveis no `.env`:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `AGENT_API_BASE_URL` | URL base das Edge Functions | `https://xxx.supabase.co/functions/v1` |
| `AGENT_POLL_INTERVAL` | Intervalo padrão de heartbeat (segundos) | `60` |
| `AGENT_STATE_FILE` | Caminho do arquivo de estado | `storage/state.json` |
| `AGENT_ACTIVATION_CODE` | Código de ativação único | `XXXX-XXXX-XXXX-XXXX` |

3. Crie a estrutura de diretórios necessária:
```bash
mkdir -p storage logs
```

4. Inicialize o arquivo de estado:
```bash
echo '{"agent_id": null, "access_token": null, "refresh_token": null}' > storage/state.json
```

## Execução

```bash
# Executar normalmente
python main.py

# Resetar estado do agent (para re-registro)
python main.py --reset-default
```

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
```

## Endpoints Utilizados

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/register-agent` | POST | Registro inicial com activation code |
| `/agent-heartbeat` | POST | Heartbeat periódico |
| `/agent-refresh` | POST | Renovação de access token |

## Tratamento de Erros

| Código do Backend | Ação do Agent |
|-------------------|---------------|
| `TOKEN_EXPIRED` | Chama `/agent-refresh` automaticamente |
| `INVALID_SIGNATURE` | Limpa estado local, para execução |
| `INVALID_TOKEN` | Limpa estado local, para execução |
| `BLOCKED` / `REVOKED` | Para execução com erro crítico |

## Estrutura de Arquivos

```
python-agent/
├── README.md              # Esta documentação
├── requirements.txt       # Dependências Python
├── .env.example          # Template de configuração
├── .env                  # Configuração real (não versionado)
├── main.py               # Entry point
├── storage/
│   └── state.json        # Estado persistente do agent
├── logs/
│   └── agent.log         # Logs com rotação
└── agent/
    ├── __init__.py       # Package marker
    ├── config.py         # Carregamento de configurações
    ├── state.py          # Gerenciamento de estado
    ├── api_client.py     # Cliente HTTP
    ├── auth.py           # Autenticação
    ├── heartbeat.py      # Lógica de heartbeat
    ├── scheduler.py      # Loop principal
    └── logger.py         # Sistema de logging
```

## Troubleshooting

### Agent não registra
- Verifique se `AGENT_ACTIVATION_CODE` está configurado
- Confirme que o código não expirou no backend
- Verifique conectividade com `AGENT_API_BASE_URL`

### Token inválido após reinício
- Execute `python main.py --reset-default`
- Configure um novo `AGENT_ACTIVATION_CODE`

### Logs não aparecem
- Verifique se o diretório `logs/` existe
- Confirme permissões de escrita

## Desenvolvimento

Este agent foi desenvolvido para trabalhar em conjunto com as Edge Functions do InfraScope360:
- `register-agent`: Registro e emissão de tokens
- `agent-heartbeat`: Validação e monitoramento
- `agent-refresh`: Renovação de access tokens
