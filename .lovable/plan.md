

# Plano: Corrigir Execução de Tasks M365 PowerShell

## Problema Identificado

O agent recebe a task M365, mas com **0 steps** porque:

1. A função SQL `rpc_get_agent_tasks` retorna `blueprint = '{"steps": []}'` (vazio) para tasks M365
2. O payload contém os dados corretos (`module`, `commands`, `app_id`, etc.)
3. O executor `powershell` existe no agent, mas não está registrado no `TaskExecutor`

**Logs do problema:**
```
Executando tarefa 26ca8244-91a3-4c2f-bf9e-c489d26de1a2 com 0 steps
status=completed, tempo=18ms, completed=0, failed=0
```

---

## Solução

Duas correções necessárias:

### 1. Registrar Executor PowerShell no Agent Python

**Arquivo:** `python-agent/agent/tasks.py`

Adicionar o `PowerShellExecutor` na lista de executors:

```python
from agent.executors.powershell import PowerShellExecutor

# Dentro de __init__:
self._executors = {
    'http_request': HTTPRequestExecutor(logger),
    'http_session': HTTPSessionExecutor(logger),
    'ssh_command': SSHExecutor(logger),
    'snmp_query': SNMPExecutor(logger),
    'dns_query': DNSQueryExecutor(logger),
    'amass': AmassExecutor(logger),
    'powershell': PowerShellExecutor(logger),  # ADICIONAR
}
```

### 2. Modificar Função SQL para Gerar Step PowerShell

**Arquivo:** Nova migration SQL

A função `rpc_get_agent_tasks` precisa transformar o `payload` das tasks M365 em um step válido:

```sql
-- Para tasks M365, converter payload em step
json_build_object(
  'steps', json_build_array(
    json_build_object(
      'id', 'powershell_exec',
      'type', 'powershell',
      'params', json_build_object(
        'module', t.payload->>'module',
        'commands', t.payload->'commands',
        'app_id', cred.azure_app_id,
        'tenant_id', mt.tenant_id,
        'organization', t.payload->>'organization'
      )
    )
  )
) as blueprint
```

---

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────────────────────┐
│  ANTES (com problema)                                                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Edge Function → cria task com payload.commands                            │
│       ↓                                                                    │
│  rpc_get_agent_tasks → retorna blueprint = {"steps": []}  ← VAZIO         │
│       ↓                                                                    │
│  Agent → task.steps = []  → 0 steps executados                            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  DEPOIS (corrigido)                                                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Edge Function → cria task com payload.commands                            │
│       ↓                                                                    │
│  rpc_get_agent_tasks → converte payload em step powershell                │
│       ↓                                                                    │
│  Agent → task.steps = [{type: "powershell", params: {...}}]               │
│       ↓                                                                    │
│  PowerShellExecutor → executa Connect-ExchangeOnline + comandos           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `python-agent/agent/tasks.py` | Registrar `PowerShellExecutor` |
| `supabase/migrations/*.sql` | Atualizar `rpc_get_agent_tasks` para gerar steps M365 |

---

## Mudanças Detalhadas

### Python Agent - `tasks.py`

```python
# Linha 15: Adicionar import
from agent.executors.powershell import PowerShellExecutor

# Linha 42-50: Adicionar executor
self._executors = {
    'http_request': HTTPRequestExecutor(logger),
    'http_session': HTTPSessionExecutor(logger),
    'ssh_command': SSHExecutor(logger),
    'snmp_query': SNMPExecutor(logger),
    'dns_query': DNSQueryExecutor(logger),
    'amass': AmassExecutor(logger),
    'powershell': PowerShellExecutor(logger),
}
```

### SQL Migration - `rpc_get_agent_tasks`

Modificar o bloco M365 para:

```sql
-- M365 Tenant tasks
SELECT
  t.id,
  t.task_type,
  t.target_id,
  t.target_type,
  t.payload,
  t.priority,
  t.expires_at,
  json_build_object(
    'id', mt.id,
    'type', 'm365_tenant',
    'tenant_id', mt.tenant_id,
    'tenant_domain', mt.tenant_domain,
    'display_name', mt.display_name,
    'credentials', json_build_object(
      'azure_app_id', cred.azure_app_id,
      'auth_type', cred.auth_type,
      'certificate_thumbprint', COALESCE(cred.certificate_thumbprint, a.certificate_thumbprint)
    )
  ) as target,
  -- Gerar step dinâmico a partir do payload
  json_build_object(
    'steps', json_build_array(
      json_build_object(
        'id', COALESCE(t.payload->>'test_type', 'powershell_exec'),
        'type', 'powershell',
        'params', json_build_object(
          'module', COALESCE(t.payload->>'module', 'ExchangeOnline'),
          'commands', COALESCE(t.payload->'commands', '[]'::json),
          'app_id', cred.azure_app_id,
          'tenant_id', mt.tenant_id,
          'organization', t.payload->>'organization'
        )
      )
    )
  ) as blueprint
FROM ...
```

---

## Resultado Esperado

1. **Agent recebe a task** com 1 step do tipo `powershell`
2. **PowerShellExecutor** é chamado com os parâmetros corretos
3. **Executa os comandos** Exchange Online (`Get-EXOMailbox`, `Get-OrganizationConfig`)
4. **Retorna resultados** via `agent-task-result`
5. **Página de Execuções** mostra resultado da task

**Log esperado após correção:**
```
Executando tarefa ... com 1 steps (progressive=True)
Executing PowerShell ExchangeOnline commands: ['test_connection', 'organization_config']
PowerShell execution successful, 2 results
Tarefa ... finalizada: status=completed, tempo=...ms, completed=1, failed=0
```

