
# Plano: Página de Administração de Tarefas

## Objetivo

Criar uma página completa em **Administração > Tarefas** (`/tasks`) com visualizações gráficas, estatísticas detalhadas e gerenciamento de execuções de tarefas dos agents.

## Arquitetura da Solução

```text
Nova Estrutura de Navegação
---------------------------
Administração
├── Administradores
├── Workspaces
├── Configurações
├── Coletas
└── Tarefas (NOVA)  <-- Ícone: Activity
```

## Componentes da Página

### 1. Visão Geral com Cards de Estatísticas

```text
┌────────────────────────────────────────────────────────────────────────┐
│  Administração > Tarefas                                               │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────────┤
│   Total     │  Pendentes  │  Executando │  Concluídas │  Falhas/Timeout│
│    32       │      1      │      0      │     20      │     11         │
│  tarefas    │  aguardando │   em curso  │   sucesso   │   erros        │
└─────────────┴─────────────┴─────────────┴─────────────┴────────────────┘
```

### 2. Gráficos de Visualização

#### 2.1 Gráfico de Área: Execuções por Período
- Eixo X: Data/hora (últimas 24h ou 7 dias)
- Eixo Y: Quantidade de tarefas
- Áreas coloridas por status (completed, failed, timeout)

#### 2.2 Gráfico de Pizza: Distribuição por Status
- Segmentos: pending, running, completed, failed, timeout, cancelled
- Cores semânticas (verde=sucesso, vermelho=erro, amarelo=pendente)

#### 2.3 Gráfico de Barras: Tempo Médio de Execução por Agent
- Barras horizontais mostrando performance de cada agent
- Destaque para agents com maior tempo médio

### 3. Tabela de Tarefas com Filtros Avançados

```text
┌──────────────────────────────────────────────────────────────────────┐
│  [Buscar...]  [Status ▾]  [Agent ▾]  [Workspace ▾]  [Período ▾]      │
├──────────────────────────────────────────────────────────────────────┤
│  Firewall    │ Agent     │ Status   │ Criado    │ Duração  │ Ações  │
├──────────────┼───────────┼──────────┼───────────┼──────────┼────────┤
│  FW-Core-01  │ Agent-HQ  │ ✓ Concl. │ há 5 min  │ 12.3s    │ 👁 ⛔  │
│  FW-DR-02    │ Agent-DR  │ ✕ Falhou │ há 10 min │ 8.1s     │ 👁 🔄  │
└──────────────┴───────────┴──────────┴───────────┴──────────┴────────┘
```

### 4. Diálogo de Detalhes da Tarefa

- Informações básicas (firewall, agent, workspace)
- Timeline de execução dos steps
- Raw JSON da resposta
- Mensagens de erro detalhadas

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/admin/TasksPage.tsx` | Criar | Página principal com gráficos e tabela |
| `src/components/admin/TaskStatsCards.tsx` | Criar | Cards de estatísticas reutilizáveis |
| `src/components/admin/TaskStatusChart.tsx` | Criar | Gráfico de pizza de distribuição |
| `src/components/admin/TaskTimelineChart.tsx` | Criar | Gráfico de área temporal |
| `src/components/admin/TaskAgentPerformance.tsx` | Criar | Gráfico de barras por agent |
| `src/components/admin/TaskDetailDialog.tsx` | Criar | Dialog de detalhes expandido |
| `src/components/layout/AppLayout.tsx` | Modificar | Adicionar item "Tarefas" no menu Admin |
| `src/App.tsx` | Modificar | Adicionar rota `/tasks` |

## Detalhes Técnicos

### Estrutura do TasksPage.tsx

```typescript
// Imports de Recharts
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

// Queries principais
const { data: tasks } = useQuery(['admin-tasks'], fetchAllTasks);
const { data: stats } = useQuery(['task-stats'], fetchTaskStats);
const { data: timelineData } = useQuery(['task-timeline'], fetchTimelineData);
const { data: agentPerformance } = useQuery(['agent-performance'], fetchAgentPerformance);
```

### Queries de Dados para Gráficos

#### Timeline (Últimos 7 dias)
```sql
SELECT 
  DATE_TRUNC('day', created_at) as date,
  status,
  COUNT(*) as count
FROM agent_tasks
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at), status
ORDER BY date
```

#### Performance por Agent
```sql
SELECT 
  a.name as agent_name,
  COUNT(t.id) as total_tasks,
  AVG(t.execution_time_ms) as avg_time_ms,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed
FROM agent_tasks t
JOIN agents a ON t.agent_id = a.id
GROUP BY a.id, a.name
ORDER BY total_tasks DESC
```

### Cores Semânticas dos Gráficos

```typescript
const chartConfig = {
  completed: { label: 'Concluídas', color: 'hsl(142, 76%, 36%)' },  // Verde
  failed: { label: 'Falhas', color: 'hsl(0, 84%, 60%)' },          // Vermelho
  timeout: { label: 'Timeout', color: 'hsl(25, 95%, 53%)' },       // Laranja
  pending: { label: 'Pendentes', color: 'hsl(48, 96%, 53%)' },     // Amarelo
  running: { label: 'Executando', color: 'hsl(217, 91%, 60%)' },   // Azul
  cancelled: { label: 'Canceladas', color: 'hsl(0, 0%, 45%)' },    // Cinza
};
```

### Filtros Implementados

1. **Busca por texto**: Firewall, Agent, Tipo de tarefa
2. **Status**: Dropdown com todas as opções
3. **Agent**: Dropdown populado dinamicamente
4. **Workspace**: Dropdown com workspaces do usuário
5. **Período**: Seletor de range de datas (últimas 24h, 7 dias, 30 dias, personalizado)

### Ações Disponíveis

| Ação | Condição | Descrição |
|------|----------|-----------|
| Ver Detalhes | Sempre | Abre dialog com informações completas |
| Cancelar | status = pending | Marca tarefa como cancelada |
| Re-executar | status = failed/timeout | Cria nova tarefa com mesmo payload |
| Ver Análise | status = completed | Navega para página de análise do firewall |

## Layout da Página

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Administração > Tarefas                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Cards de Estatísticas (5 cards em grid)                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐  ┌───────────────────────────────────┐   │
│  │  Gráfico de Pizza         │  │  Gráfico de Área (Timeline)       │   │
│  │  Distribuição por Status  │  │  Execuções nos últimos 7 dias     │   │
│  │  (1/3 largura)            │  │  (2/3 largura)                    │   │
│  └───────────────────────────┘  └───────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Gráfico de Barras: Performance por Agent                       │   │
│  │  (largura total, altura menor)                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Filtros: [Busca] [Status] [Agent] [Workspace] [Período]        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Tabela de Tarefas com paginação                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Integração com Menu de Administração

O item "Tarefas" será adicionado ao menu Administração com o ícone `Activity`, seguindo o padrão visual (cor warning/amarelo) dos outros itens administrativos.

## Diferenças da Página Existente (TaskExecutionsPage)

| Aspecto | TaskExecutionsPage (Firewall) | TasksPage (Admin) |
|---------|------------------------------|-------------------|
| Localização | Firewall > Execuções | Administração > Tarefas |
| Escopo | Tarefas do módulo Firewall | Todas as tarefas do sistema |
| Gráficos | Não possui | Pizza, Área, Barras |
| Filtro por Workspace | Não | Sim |
| Filtro por Período | Não | Sim (com datepicker) |
| Visão de Performance | Não | Sim (gráfico por agent) |
| Acesso | workspace_admin + | super_admin only |

## Padrões Seguidos

1. **Breadcrumb**: Utilizando `PageBreadcrumb` existente
2. **Cards**: Estilo `glass-card` do projeto
3. **Gráficos**: Usando `ChartContainer` e `ChartTooltipContent` do shadcn/recharts
4. **Tabela**: Componentes `Table*` existentes
5. **Dialog**: Padrão `lg` com `ScrollArea` interno
6. **Cores**: Paleta semântica já definida no projeto

## Ordem de Implementação

1. Criar componente `TaskStatsCards.tsx`
2. Criar componente `TaskStatusChart.tsx` (pizza)
3. Criar componente `TaskTimelineChart.tsx` (área)
4. Criar componente `TaskAgentPerformance.tsx` (barras)
5. Criar componente `TaskDetailDialog.tsx`
6. Criar página principal `TasksPage.tsx`
7. Atualizar `AppLayout.tsx` com novo item no menu
8. Atualizar `App.tsx` com nova rota
