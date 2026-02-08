
# Plano: Corrigir Integração M365 Agent Blueprint

## Problema Identificado

O erro `"powershell_exec: commands list is required"` ocorre porque:

1. O `trigger-m365-posture-analysis` cria a task com payload mínimo:
   ```json
   {
     "analysis_id": "...",
     "tenant_id": "...",
     "tenant_domain": "..."
   }
   ```

2. A RPC `rpc_get_agent_tasks` gera o blueprint **dinamicamente** esperando `payload->commands`:
   ```sql
   'commands', COALESCE(t.payload->'commands', '[]'::jsonb)
   ```

3. Como não há `commands` no payload, o array fica vazio e o PowerShell executor falha.

## Solução Proposta

Atualizar a RPC `rpc_get_agent_tasks` para buscar o blueprint do banco de dados (como já faz para firewall e external_domain), em vez de esperar os commands no payload.

```text
Antes:
┌──────────────────────────────────────────────────────────────┐
│  rpc_get_agent_tasks (M365 section)                          │
│                                                              │
│  payload->commands ───► COALESCE(..., '[]')                  │
│                                       │                      │
│                              Array vazio!                    │
└──────────────────────────────────────────────────────────────┘

Depois:
┌──────────────────────────────────────────────────────────────┐
│  rpc_get_agent_tasks (M365 section)                          │
│                                                              │
│  device_blueprints ───► WHERE device_type = 'm365'           │
│          │                AND executor_type = 'agent'        │
│          ▼                                                   │
│  collection_steps.steps                                      │
└──────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

### 1. Migração SQL: Atualizar `rpc_get_agent_tasks`

Modificar a seção M365 da função para buscar o blueprint do banco:

```sql
-- M365 Tenant tasks section
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
  -- NOVO: Buscar blueprint do banco em vez de gerar dinamicamente
  COALESCE(
    (
      SELECT db.collection_steps
      FROM public.device_blueprints db
      WHERE db.device_type_id = (
        SELECT id FROM public.device_types 
        WHERE code = 'm365' AND is_active = true 
        LIMIT 1
      )
      AND db.executor_type = 'agent'  -- Importante: apenas blueprints do agent
      AND db.is_active = true
      ORDER BY db.version DESC
      LIMIT 1
    ),
    -- Fallback: gerar dinamicamente se payload tiver commands
    CASE WHEN t.payload->'commands' IS NOT NULL THEN
      jsonb_build_object(
        'steps', jsonb_build_array(
          jsonb_build_object(
            'id', COALESCE(t.payload->>'test_type', 'powershell_exec'),
            'type', 'powershell',
            'params', jsonb_build_object(
              'module', COALESCE(t.payload->>'module', 'ExchangeOnline'),
              'commands', t.payload->'commands',
              'app_id', cred.azure_app_id,
              'tenant_id', mt.tenant_id,
              'organization', COALESCE(t.payload->>'organization', mt.tenant_domain)
            )
          )
        )
      )
    ELSE
      '{"steps": []}'::jsonb
    END
  ) as blueprint
FROM public.agent_tasks t
...
```

### 2. Simplificar `trigger-m365-posture-analysis`

O payload pode permanecer simples (apenas metadados), pois o blueprint será buscado do banco:

```typescript
payload: {
  analysis_id: historyRecord.id,
  tenant_id: tenant.tenant_id,
  tenant_domain: tenant.tenant_domain,
  // Não precisa mais de 'commands' - o banco resolve
}
```

## Fluxo Corrigido

1. **Usuário clica "Analisar"** no tenant M365
2. `trigger-m365-posture-analysis` cria `agent_task` com payload mínimo
3. Agent chama `GET /agent-tasks`
4. `rpc_get_agent_tasks` busca blueprint "M365 - Exchange & SharePoint (Agent)" do banco
5. Agent recebe tasks com `steps` completos (16 comandos PowerShell)
6. PowerShell executor processa cada step normalmente

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Atualizar `rpc_get_agent_tasks` para buscar blueprint M365 do banco |

## Benefícios

1. **Consistência**: M365 segue o mesmo padrão de firewall e external_domain
2. **Manutenibilidade**: Alterar blueprint via admin UI atualiza automaticamente as tasks
3. **Flexibilidade**: Fallback para payload dinâmico permite testes manuais
4. **Sem breaking changes**: Tasks com `commands` no payload ainda funcionam

## Seção Técnica

A RPC precisa:
1. Buscar o `device_type_id` onde `code = 'm365'`
2. Buscar o blueprint onde `executor_type = 'agent'` (não o edge_function)
3. Retornar `collection_steps` diretamente como blueprint
4. Manter fallback para casos de teste manual com commands no payload
