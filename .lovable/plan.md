
# Plano: Exibir Tasks M365 na Página de Execuções

## Problema Identificado

A task de teste de conexão Exchange Online foi criada com sucesso:
- **ID**: `ea2bde86-6e1c-47f3-a21d-caab7b544675`
- **Status**: `running`
- **target_type**: `m365_tenant`

Porém, a página **Microsoft 365 > Execuções** busca dados da tabela `m365_posture_history` (análises de postura), não da tabela `agent_tasks`. Isso significa que tasks de agent para tenants M365 não são exibidas.

---

## Solução Proposta

Refatorar a página `M365ExecutionsPage` para exibir **ambos os tipos de execuções**:

1. **Análises de Postura** (da tabela `m365_posture_history`) - execuções existentes
2. **Tasks de Agent** (da tabela `agent_tasks` com `target_type = 'm365_tenant'`) - testes PowerShell/Exchange

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/m365/M365ExecutionsPage.tsx` | Adicionar busca e exibição de `agent_tasks` com `target_type = 'm365_tenant'` |

---

## Mudanças Detalhadas

### 1. Adicionar Query para Agent Tasks

Criar uma segunda query para buscar tasks do agent:

```typescript
const { data: agentTasks = [] } = useQuery({
  queryKey: ['m365-agent-tasks', timeFilter, statusFilter, workspaceIds],
  queryFn: async () => {
    // Buscar tenant IDs acessíveis
    const { data: tenants } = await supabase
      .from('m365_tenants')
      .select('id')
      .in('client_id', workspaceIds);

    const tenantIds = (tenants || []).map(t => t.id);
    if (tenantIds.length === 0) return [];

    // Buscar tasks com target_type = 'm365_tenant'
    let query = supabase
      .from('agent_tasks')
      .select('id, agent_id, task_type, target_id, target_type, status, payload, result, error_message, execution_time_ms, created_at, started_at, completed_at')
      .eq('target_type', 'm365_tenant')
      .in('target_id', tenantIds)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },
});
```

---

### 2. Adicionar Tabs para Separar Tipos

Usar `Tabs` do Radix para separar visualizações:

```text
┌─────────────────────────────────────────────────────────────┐
│  Execuções de Análise                                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐ ┌──────────────────┐                  │
│  │ Análises Postura │ │ Tasks PowerShell │                  │
│  └──────────────────┘ └──────────────────┘                  │
│                                                             │
│  [ Stats Cards ]                                            │
│                                                             │
│  [ Filters ]                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Tenant   │ Tipo          │ Status    │ Resultado │ Data ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ BRASILUX │ Exchange Test │ Running   │    -      │ 2m   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

### 3. Exibir Detalhes da Task

Ao clicar em uma task PowerShell, mostrar:
- **Payload**: Comandos enviados (`Get-EXOMailbox`, `Get-OrganizationConfig`)
- **Result**: Saída dos comandos (quando concluído)
- **Error**: Mensagem de erro (se falhou)
- **Duração**: Tempo de execução

---

### 4. Indicadores de Tipo de Task

Adicionar badges para diferenciar tipos:

| Task Type | Badge |
|-----------|-------|
| `m365_powershell` | `PowerShell` (roxo) |
| `m365_graph_api` | `Graph API` (azul) |

---

## Fluxo de Dados

```text
┌──────────────────────────┐
│  M365ExecutionsPage      │
├──────────────────────────┤
│                          │
│  Tab: Análises Postura   │──► m365_posture_history
│                          │
│  Tab: Tasks PowerShell   │──► agent_tasks
│       └─ target_type =   │    WHERE target_type = 'm365_tenant'
│          'm365_tenant'   │
│                          │
└──────────────────────────┘
```

---

## Detalhes Técnicos

### Mapeamento de Status

Os status de `agent_tasks` são compatíveis com `m365_posture_history`:
- `pending` / `running` / `completed` / `failed` (ambos usam)
- `timeout` / `cancelled` (exclusivo de agent_tasks)

### Lookup de Recursos

- **Tenant**: Buscar nome via `m365_tenants.display_name`
- **Agent**: Buscar nome via `agents.name`
- **Workspace**: Já disponível via `m365_tenants.client_id` -> `clients.name`

---

## Resultado Esperado

Após a implementação:

1. A página **Execuções M365** terá duas abas:
   - **Análises de Postura**: Lista de `m365_posture_history` (comportamento atual)
   - **Tasks de Agent**: Lista de `agent_tasks` com `target_type = 'm365_tenant'`

2. A task de teste Exchange (`ea2bde86-...`) aparecerá na aba **Tasks de Agent**

3. Será possível ver o status, resultado e erros de cada task

4. O auto-refresh funcionará para tasks `running` ou `pending`
