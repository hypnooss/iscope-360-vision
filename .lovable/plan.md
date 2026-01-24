
# Plano: Refatoração para Agent Genérico com Blueprints na Plataforma

## Visão Geral

Transformar o agent de "inteligente" (contém lógica específica de cada fabricante) para "genérico" (executa instruções básicas enviadas pela plataforma). Toda a inteligência de coleta, endpoints e regras de análise ficará centralizada no backend.

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          NOVA ARQUITETURA                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   PLATAFORMA (Lovable Cloud)              AGENT (Genérico)                      │
│   ──────────────────────────              ────────────────                      │
│                                                                                 │
│   ┌──────────────────────────┐            ┌──────────────────────────┐          │
│   │  device_blueprints       │            │  Executores Genéricos    │          │
│   │  ├── FortiGate 7.x       │            │  ├── http_request        │          │
│   │  ├── Palo Alto           │            │  ├── ssh_command         │          │
│   │  ├── Cisco ASA           │            │  └── snmp_query          │          │
│   │  └── SonicWall           │            │                          │          │
│   └──────────────────────────┘            └──────────────────────────┘          │
│              │                                       ↑                          │
│              ▼                                       │                          │
│   ┌──────────────────────────┐                       │                          │
│   │  Gera lista de steps     │──── payload ─────────►│                          │
│   │  para cada coleta        │                       │                          │
│   └──────────────────────────┘                       │                          │
│              │                                       │                          │
│              ▼                             ┌─────────┴─────────┐                │
│   ┌──────────────────────────┐             │  Retorna dados    │                │
│   │  compliance_rules        │◄────────────│  brutos (JSON)    │                │
│   │  Processa raw data       │             └───────────────────┘                │
│   │  Calcula scores          │                                                  │
│   └──────────────────────────┘                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Fase 1: Novas Tabelas no Banco de Dados

### Tabela: `device_types`
Define os tipos de dispositivos suportados (FortiGate, Palo Alto, Cisco, etc.)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| code | text | Código único (`fortigate`, `paloalto`, `cisco_asa`) |
| name | text | Nome legível (`FortiGate`, `Palo Alto Networks`) |
| vendor | text | Fabricante |
| category | text | `firewall`, `switch`, `router`, `wlc` |
| icon | text | Ícone para UI |
| is_active | boolean | Se está habilitado |

### Tabela: `device_blueprints`
Define os "blueprints" de coleta para cada tipo de dispositivo.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| device_type_id | uuid | FK para device_types |
| version | text | Versão do blueprint (`7.0`, `7.2`, `any`) |
| name | text | Nome do blueprint |
| description | text | Descrição |
| collection_steps | jsonb | Array de steps para coleta |
| created_at | timestamp | |
| updated_at | timestamp | |
| is_active | boolean | |

### Estrutura do `collection_steps` (JSONB)

```json
{
  "steps": [
    {
      "id": "system_status",
      "executor": "http_request",
      "config": {
        "method": "GET",
        "path": "/api/v2/monitor/system/status",
        "headers": {
          "Authorization": "Bearer {{api_key}}"
        }
      },
      "output_key": "system_status"
    },
    {
      "id": "password_policy", 
      "executor": "http_request",
      "config": {
        "method": "GET",
        "path": "/api/v2/cmdb/system/password-policy"
      },
      "output_key": "password_policy"
    },
    {
      "id": "global_settings",
      "executor": "http_request", 
      "config": {
        "method": "GET",
        "path": "/api/v2/cmdb/system/global"
      },
      "output_key": "global_settings"
    }
  ]
}
```

### Tabela: `compliance_rules`
Regras para processar os dados coletados e gerar scores.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| device_type_id | uuid | FK para device_types |
| code | text | Código da regra (`admin_password_policy`) |
| name | text | Nome legível |
| category | text | Categoria (`Autenticação`, `Segurança`) |
| severity | text | `high`, `medium`, `low` |
| description | text | Descrição da regra |
| evaluation_logic | jsonb | Lógica de avaliação |
| is_active | boolean | |

### Estrutura do `evaluation_logic` (JSONB)

```json
{
  "source_key": "password_policy",
  "field_path": "results.status",
  "conditions": [
    {
      "operator": "equals",
      "value": "enable",
      "result": "pass"
    },
    {
      "operator": "equals", 
      "value": "disable",
      "result": "fail"
    }
  ],
  "default_result": "unknown",
  "details_template": "Status: {{value}}"
}
```

## Fase 2: Refatorar Edge Functions

### Modificar `agent-tasks`

O endpoint passará a enviar **steps genéricos** em vez de apenas o tipo de tarefa:

```typescript
// Nova resposta de agent-tasks
{
  tasks: [
    {
      id: "task-uuid",
      type: "data_collection",  // Tipo genérico
      target: {
        id: "firewall-uuid",
        base_url: "https://192.168.1.1",
        credentials: {
          api_key: "xxx"
        }
      },
      steps: [
        {
          id: "system_status",
          executor: "http_request",
          config: {
            method: "GET",
            path: "/api/v2/monitor/system/status",
            headers: {
              "Authorization": "Bearer {{api_key}}"
            }
          }
        },
        // ... mais steps
      ]
    }
  ]
}
```

### Modificar `agent-task-result`

Receber dados brutos e processar no backend:

```typescript
// Agent envia:
{
  task_id: "xxx",
  status: "completed",
  result: {
    // Dados brutos coletados
    "system_status": { "results": { "hostname": "...", "version": "..." } },
    "password_policy": { "results": { "status": "enable" } },
    "global_settings": { "results": { "strong-crypto": "enable" } }
  }
}

// Backend processa usando compliance_rules e gera:
// - Score calculado
// - Checks individuais (pass/fail/warn)
// - Salva em analysis_history
```

### Nova Edge Function: `process-compliance-result`

Função interna que aplica as `compliance_rules` aos dados brutos:

```typescript
function processComplianceResult(rawData: object, rules: ComplianceRule[]): ComplianceResult {
  const checks = rules.map(rule => {
    const value = getNestedValue(rawData, rule.source_key, rule.field_path);
    const status = evaluateConditions(value, rule.conditions);
    
    return {
      id: rule.code,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      status: status,
      details: interpolate(rule.details_template, { value })
    };
  });
  
  const score = calculateScore(checks);
  
  return { score, checks, categories: groupByCategory(checks) };
}
```

## Fase 3: Refatorar Agent Python

### Novo executor genérico: `http_request.py`

```python
class HTTPRequestExecutor(BaseExecutor):
    """Executor genérico para requisições HTTP."""
    
    def run(self, step: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        config = step.get('config', {})
        
        method = config.get('method', 'GET')
        path = config.get('path', '/')
        headers = self._interpolate_headers(config.get('headers', {}), context)
        body = config.get('body')
        
        url = f"{context['base_url'].rstrip('/')}{path}"
        
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=body,
            verify=False,
            timeout=30
        )
        
        return {
            'status_code': response.status_code,
            'data': response.json() if response.ok else None,
            'error': None if response.ok else response.text
        }
```

### Refatorar `tasks.py`

```python
class TaskExecutor:
    def __init__(self, api, state, logger):
        self.api = api
        self.state = state
        self.logger = logger
        self._executors = {
            'http_request': HTTPRequestExecutor(self.logger),
            'ssh_command': SSHExecutor(self.logger),
            'snmp_query': SNMPExecutor(self.logger),
        }
    
    def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Executa todos os steps de uma tarefa."""
        steps = task.get('steps', [])
        target = task.get('target', {})
        
        context = {
            'base_url': target.get('base_url') or target.get('url'),
            'api_key': target.get('credentials', {}).get('api_key'),
            'host': target.get('host'),
            'username': target.get('credentials', {}).get('username'),
            'password': target.get('credentials', {}).get('password'),
            'community': target.get('credentials', {}).get('community'),
        }
        
        results = {}
        
        for step in steps:
            step_id = step.get('id')
            executor_type = step.get('executor')
            
            executor = self._executors.get(executor_type)
            if not executor:
                results[step_id] = {'error': f'Executor desconhecido: {executor_type}'}
                continue
            
            try:
                result = executor.run(step, context)
                results[step_id] = result.get('data')
            except Exception as e:
                results[step_id] = {'error': str(e)}
        
        return {
            'status': 'completed',
            'result': results
        }
```

### Simplificar SSH e SNMP executores

Os executores SSH e SNMP também passam a receber steps genéricos:

```python
# SSH step example
{
    "id": "get_config",
    "executor": "ssh_command",
    "config": {
        "commands": ["show running-config", "show version"]
    }
}

# SNMP step example  
{
    "id": "device_info",
    "executor": "snmp_query",
    "config": {
        "operation": "get",
        "oids": ["1.3.6.1.2.1.1.1.0", "1.3.6.1.2.1.1.5.0"]
    }
}
```

## Fase 4: Migrar Lógica Existente

### Criar blueprints para FortiGate

Migrar a lógica de `fortigate.py` para registros em `device_blueprints`:

1. Criar device_type: `fortigate`
2. Criar blueprint com steps para todos os endpoints
3. Criar compliance_rules para cada check

### Seed data inicial

```sql
-- Device type FortiGate
INSERT INTO device_types (code, name, vendor, category)
VALUES ('fortigate', 'FortiGate', 'Fortinet', 'firewall');

-- Blueprint para FortiGate
INSERT INTO device_blueprints (device_type_id, version, name, collection_steps)
VALUES (
  (SELECT id FROM device_types WHERE code = 'fortigate'),
  'any',
  'FortiGate Standard Compliance',
  '{
    "steps": [
      {"id": "system_status", "executor": "http_request", "config": {"method": "GET", "path": "/api/v2/monitor/system/status"}},
      {"id": "password_policy", "executor": "http_request", "config": {"method": "GET", "path": "/api/v2/cmdb/system/password-policy"}},
      {"id": "global_settings", "executor": "http_request", "config": {"method": "GET", "path": "/api/v2/cmdb/system/global"}},
      {"id": "dns_settings", "executor": "http_request", "config": {"method": "GET", "path": "/api/v2/cmdb/system/dns"}},
      {"id": "ntp_settings", "executor": "http_request", "config": {"method": "GET", "path": "/api/v2/cmdb/system/ntp"}},
      {"id": "log_settings", "executor": "http_request", "config": {"method": "GET", "path": "/api/v2/cmdb/log/setting"}}
    ]
  }'::jsonb
);

-- Compliance rules
INSERT INTO compliance_rules (device_type_id, code, name, category, severity, evaluation_logic)
VALUES 
  ((SELECT id FROM device_types WHERE code = 'fortigate'), 
   'admin_password_policy', 'Política de Senha Admin', 'Autenticação', 'high',
   '{"source_key": "password_policy", "field_path": "results.status", "conditions": [{"operator": "equals", "value": "enable", "result": "pass"}], "default_result": "fail"}'::jsonb
  );
```

## Estrutura Final de Arquivos

```text
python-agent/
├── main.py
├── requirements.txt
├── agent/
│   ├── tasks.py              # Refatorado para steps genéricos
│   └── executors/
│       ├── base.py
│       ├── http_request.py   # NOVO - executor genérico HTTP
│       ├── ssh.py            # Mantido, recebe steps
│       └── snmp.py           # Mantido, recebe steps
│   # REMOVIDO: fortigate.py (lógica migrada para backend)

supabase/functions/
├── agent-tasks/              # Modificado - envia steps
├── agent-task-result/        # Modificado - processa com rules
└── ...
```

## Ordem de Implementação

1. **Banco de Dados**
   - Criar tabelas `device_types`, `device_blueprints`, `compliance_rules`
   - Adicionar coluna `device_type_id` na tabela `firewalls`
   - Configurar RLS policies
   - Popular com seed data do FortiGate

2. **Edge Functions**
   - Modificar `agent-tasks` para montar steps do blueprint
   - Modificar `agent-task-result` para processar com compliance_rules
   - Criar função de processamento de compliance

3. **Agent Python**
   - Criar `http_request.py` executor genérico
   - Refatorar `tasks.py` para processar steps
   - Ajustar SSH/SNMP para formato de steps
   - Remover `fortigate.py` (lógica já no backend)

4. **Interface Admin (Futuro)**
   - Tela para gerenciar device_types
   - Tela para editar blueprints
   - Tela para configurar compliance_rules

## Benefícios

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Atualização de endpoints** | Requer deploy em todos os agents | Apenas altera registro no banco |
| **Novo fabricante** | Código Python novo | Cria blueprint na plataforma |
| **Segurança** | Lógica exposta no agent | Lógica protegida no backend |
| **Manutenção** | Múltiplas versões de agent | Agent único e estável |
| **Escalabilidade** | Difícil adicionar checks | Apenas adiciona rules no banco |

## Considerações Técnicas

- **Interpolação de variáveis**: O executor HTTP deve substituir `{{api_key}}`, `{{host}}`, etc.
- **Tratamento de erros**: Cada step pode falhar independentemente
- **Timeout por step**: Configurável no blueprint
- **Versionamento**: Blueprints versionados por versão de firmware
- **Cache**: Considerar cache de blueprints no backend para performance
