

# Plano: Sistema de Tarefas para o Agent Python

## Visão Geral

Implementar um sistema de filas de tarefas onde a plataforma agenda trabalhos e o agent os busca, executa e reporta resultados. O agent continuará funcionando via polling no heartbeat, mantendo compatibilidade com NAT/firewalls corporativos.

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO DE TAREFAS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PLATAFORMA                          AGENT                                 │
│   ──────────                          ─────                                 │
│                                                                             │
│   1. Usuário cadastra firewall        2. Agent faz heartbeat                │
│      com schedule "daily"                ↓                                  │
│           ↓                           3. Backend responde:                  │
│   pg_cron ou trigger verifica            has_pending_tasks: true            │
│   next_run_at <= now()                   ↓                                  │
│           ↓                           4. Agent chama GET /agent-tasks       │
│   Cria registro em agent_tasks           ↓                                  │
│   com status "pending"                5. Backend retorna lista de tarefas   │
│                                          ↓                                  │
│                                       6. Agent executa cada tarefa          │
│                                          (API FortiGate, SSH, SNMP)         │
│                                          ↓                                  │
│                                       7. Agent chama POST /agent-task-result│
│                                          com resultado                      │
│                                          ↓                                  │
│   8. Backend atualiza agent_tasks     ←──┘                                  │
│      e salva em analysis_history                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Fase 1: Infraestrutura de Banco de Dados

### Nova Tabela: `agent_tasks`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| agent_id | uuid | FK → agents |
| task_type | enum | `fortigate_compliance`, `fortigate_cve`, `ssh_command`, `snmp_query` |
| target_id | uuid | ID do dispositivo (firewall_id, etc) |
| target_type | text | `firewall`, `switch`, `router` |
| payload | jsonb | Dados para execução (url, credentials, commands) |
| status | enum | `pending`, `running`, `completed`, `failed`, `timeout` |
| result | jsonb | Resultado da execução |
| error_message | text | Mensagem de erro se falhou |
| created_at | timestamp | Quando foi criada |
| started_at | timestamp | Quando o agent começou |
| completed_at | timestamp | Quando terminou |
| expires_at | timestamp | Timeout da tarefa |
| priority | int | Prioridade (1-10, maior = mais urgente) |
| retry_count | int | Tentativas realizadas |
| max_retries | int | Máximo de tentativas |

### Enum: `task_type`
```sql
CREATE TYPE task_type AS ENUM (
  'fortigate_compliance',
  'fortigate_cve', 
  'ssh_command',
  'snmp_query',
  'ping_check'
);
```

### Enum: `task_status`
```sql
CREATE TYPE task_status AS ENUM (
  'pending',
  'running', 
  'completed',
  'failed',
  'timeout',
  'cancelled'
);
```

### RLS Policies
- Agents só podem ver/modificar suas próprias tarefas
- Usuários podem ver tarefas de dispositivos que têm acesso

## Fase 2: Edge Functions

### 2.1 Modificar `agent-heartbeat`
Adicionar campo `has_pending_tasks` na resposta:
```typescript
{
  success: true,
  agent_id: "...",
  next_heartbeat_in: 60,
  config_flag: 0,
  has_pending_tasks: true  // NOVO
}
```

### 2.2 Nova: `agent-tasks` (GET)
Retorna lista de tarefas pendentes para o agent:
```typescript
// Request: GET /agent-tasks
// Headers: Authorization: Bearer <access_token>

// Response:
{
  tasks: [
    {
      id: "task-uuid",
      type: "fortigate_compliance",
      target: {
        id: "firewall-uuid",
        url: "https://192.168.1.1",
        api_key: "encrypted-key"
      },
      priority: 5,
      expires_at: "2024-01-25T10:00:00Z"
    }
  ]
}
```

### 2.3 Nova: `agent-task-result` (POST)
Recebe resultado da execução:
```typescript
// Request: POST /agent-task-result
{
  task_id: "task-uuid",
  status: "completed",  // ou "failed"
  result: { ... },      // dados da análise
  error_message: null,
  execution_time_ms: 5432
}

// Response:
{
  success: true,
  next_task: { ... }  // opcional: próxima tarefa se houver
}
```

## Fase 3: Agent Python

### 3.1 Novo Módulo: `agent/tasks.py`
```python
class TaskExecutor:
    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger
        self.executors = {
            'fortigate_compliance': FortiGateComplianceExecutor(),
            'fortigate_cve': FortiGateCVEExecutor(),
            'ssh_command': SSHExecutor(),
            'snmp_query': SNMPExecutor(),
        }
    
    def fetch_pending_tasks(self):
        """Busca tarefas pendentes do backend"""
        return self.api.get('/agent-tasks')
    
    def execute(self, task):
        """Executa uma tarefa e retorna resultado"""
        executor = self.executors.get(task['type'])
        if not executor:
            return {'status': 'failed', 'error': f'Unknown task type: {task["type"]}'}
        
        return executor.run(task)
    
    def report_result(self, task_id, result):
        """Envia resultado para o backend"""
        self.api.post('/agent-task-result', json={
            'task_id': task_id,
            **result
        })
```

### 3.2 Novo: `agent/executors/fortigate.py`
```python
class FortiGateComplianceExecutor:
    def run(self, task):
        target = task['target']
        # Conecta à API do FortiGate
        # Executa verificações de compliance
        # Retorna resultado estruturado
```

### 3.3 Novo: `agent/executors/ssh.py`
```python
class SSHExecutor:
    def run(self, task):
        target = task['target']
        # Conecta via SSH (usando paramiko)
        # Executa comandos
        # Retorna output
```

### 3.4 Novo: `agent/executors/snmp.py`
```python
class SNMPExecutor:
    def run(self, task):
        target = task['target']
        # Faz queries SNMP (usando pysnmp)
        # Retorna dados coletados
```

### 3.5 Atualizar `main.py`
```python
def agent_loop(self):
    self.auth.ensure_authenticated()
    
    result = self.heartbeat.send(status="running", version="1.0.0")
    
    # NOVO: Verifica se há tarefas pendentes
    if result.get('has_pending_tasks'):
        self.process_pending_tasks()
    
    return result.get('next_heartbeat_in', POLL_INTERVAL)

def process_pending_tasks(self):
    tasks = self.task_executor.fetch_pending_tasks()
    
    for task in tasks.get('tasks', []):
        self.logger.info(f"Executando tarefa {task['id']}: {task['type']}")
        
        result = self.task_executor.execute(task)
        self.task_executor.report_result(task['id'], result)
```

### 3.6 Novas dependências (`requirements.txt`)
```
paramiko>=3.4.0    # SSH
pysnmp>=6.0.0      # SNMP
```

## Fase 4: Agendamento de Tarefas

### Opção A: Trigger no Banco
Quando `analysis_schedules.next_run_at <= now()`:
1. Trigger cria registro em `agent_tasks`
2. Atualiza `next_run_at` para próxima execução

### Opção B: pg_cron Job
Job periódico que:
1. Verifica schedules vencidos
2. Cria tarefas para os agents correspondentes
3. Atualiza `next_run_at`

## Estrutura Final de Arquivos

```text
python-agent/
├── main.py
├── requirements.txt
├── agent/
│   ├── __init__.py
│   ├── config.py
│   ├── state.py
│   ├── api_client.py
│   ├── auth.py
│   ├── heartbeat.py
│   ├── scheduler.py
│   ├── logger.py
│   ├── tasks.py              # NOVO
│   └── executors/            # NOVO
│       ├── __init__.py
│       ├── base.py
│       ├── fortigate.py
│       ├── ssh.py
│       └── snmp.py

supabase/functions/
├── agent-heartbeat/          # Modificado
├── agent-tasks/              # NOVO
├── agent-task-result/        # NOVO
└── ...
```

## Ordem de Implementação

1. **Banco de Dados**
   - Criar enums `task_type` e `task_status`
   - Criar tabela `agent_tasks`
   - Configurar RLS policies
   - Criar trigger/cron para gerar tarefas

2. **Edge Functions**
   - Modificar `agent-heartbeat` para incluir `has_pending_tasks`
   - Criar `agent-tasks` (GET)
   - Criar `agent-task-result` (POST)

3. **Agent Python**
   - Criar módulo `tasks.py`
   - Criar executores (fortigate, ssh, snmp)
   - Atualizar `main.py` para processar tarefas
   - Adicionar novas dependências

4. **Testes**
   - Testar fluxo completo com um firewall cadastrado
   - Verificar que resultados são salvos corretamente

## Considerações de Segurança

- **Credenciais**: API keys e senhas são armazenadas criptografadas no banco
- **Escopo**: Agent só recebe tarefas de dispositivos do seu cliente
- **Timeout**: Tarefas expiram se não executadas em tempo hábil
- **Retry**: Sistema de retry com backoff para falhas transitórias
- **Validação**: Backend valida JWT em todas as chamadas

