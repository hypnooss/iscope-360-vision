

# Unificar Abas de Execuções M365

## Objetivo

Remover as abas "Análises de Postura" e "Tasks PowerShell" e exibir todas as execuções em uma **tabela única** com colunas padronizadas.

## Colunas da Tabela Unificada

| Coluna | Fonte Posture | Fonte Agent Task |
|--------|---------------|------------------|
| Tenant | `tenant_record_id` | `target_id` |
| Agent | "-" (execução via Edge Function) | `agent_id` -> nome |
| Tipo | "Análise de Postura" (badge Cloud) | "PowerShell" (badge Terminal) |
| Status | `status` (badge colorido) | `status` (badge colorido) |
| Duração | `started_at` / `completed_at` | `execution_time_ms` ou calculado |
| Criado em | `created_at` | `created_at` |
| Ações | Botão ver detalhes | Botão ver detalhes + cancelar |

## Abordagem Tecnica

### 1. Criar tipo unificado `UnifiedExecution`

```typescript
interface UnifiedExecution {
  id: string;
  source: 'posture' | 'agent_task';
  tenantId: string;
  agentId: string | null;
  type: 'posture_analysis' | 'm365_powershell' | 'm365_graph_api';
  status: string;
  duration: string;
  createdAt: string;
  original: PostureHistory | AgentTask;
}
```

### 2. Mesclar e ordenar os dados

Combinar `executions` (posture) e `agentTasks` em um unico array, ordenado por `created_at` descendente.

### 3. Remover componente Tabs

- Remover `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- Manter uma unica tabela
- Stats cards mostram totais combinados
- Filtros aplicam a ambas as fontes

### 4. Coluna "Tipo" com badges visuais

- **Analise de Postura**: badge azul com icone Cloud
- **PowerShell**: badge roxo com icone Terminal

### 5. Coluna "Agent"

- Para posture: exibir "-" ou "Edge Function"
- Para agent tasks: exibir nome do agente

### 6. Filtro de busca unificado

Placeholder: "Buscar por tenant, agente ou workspace..."

### 7. Acoes por tipo

- Posture: botao Eye para detalhes
- Agent Task: botao Eye + botao Ban (cancelar) se pendente/running

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/m365/M365ExecutionsPage.tsx` | Remover tabs, unificar tabela, mesclar dados |

## Resultado Visual

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Execucoes de Analise                                          [Atualizar]  │
│ Monitore as analises de postura e tasks do agente M365                     │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Total: 12] [Pendentes: 2] [Executando: 1] [Concluidas: 8] [Falhas: 1]   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Buscar...]                        [Periodo: 24h]  [Status: Todos]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Tenant      │ Agent        │ Tipo              │ Status    │ Duracao │ ... │
│─────────────┼──────────────┼───────────────────┼───────────┼─────────┼─────│
│ contoso.com │ -            │ ☁ Analise Postura │ Concluida │ 2.3m    │ 👁  │
│ contoso.com │ Agent-PC01   │ ⌨ PowerShell      │ Executando│ 45.2s   │ 👁🚫│
│ fabrikam.io │ -            │ ☁ Analise Postura │ Pendente  │ -       │ 👁  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Dialogs de Detalhes

Os dois dialogs existentes (Posture Details e Task Details) serao mantidos. O clique no botao Eye abrira o dialog correto conforme o `source` do item.

