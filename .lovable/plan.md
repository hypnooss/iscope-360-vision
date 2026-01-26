

# Plano: Otimização de Performance - Páginas com Carregamento Pesado

## Diagnóstico Completo

### Páginas Afetadas

| Página | Arquivo | Query Problemática | Dados Carregados |
|--------|---------|-------------------|------------------|
| Relatórios Global | `ReportsPage.tsx` | Inclui `report_data` | ~450 MB (100 × 4.5 MB) |
| Execuções de Tarefas | `TaskExecutionsPage.tsx` | `select('*')` | **79 MB** (inclui `result` de 25 MB cada) |

### Dados do Banco

```text
agent_tasks: 46 registros = 79 MB
  - Campo 'result': até 25 MB por registro
  - Problema: SELECT * carrega tudo de uma vez

analysis_history: 9 registros = 41 MB
  - Campo 'report_data': ~4.5 MB por registro
```

---

## Solução

### Arquivo 1: `src/pages/ReportsPage.tsx`

#### 1.1 Remover `report_data` da listagem

```typescript
// Antes (linha 61)
.select('id, score, created_at, firewall_id, report_data')

// Depois
.select('id, score, created_at, firewall_id')
```

#### 1.2 Tornar `report_data` opcional na interface

```typescript
interface AnalysisHistoryItem {
  id: string;
  score: number;
  created_at: string;
  firewall_id: string;
  report_data?: any; // Opcional
  // ... resto
}
```

#### 1.3 Carregar `report_data` sob demanda (handleView/handleDownload)

Adicionar função de carregamento sob demanda similar ao FirewallReportsPage.

---

### Arquivo 2: `src/pages/firewall/TaskExecutionsPage.tsx`

#### 2.1 Substituir `select('*')` por campos específicos

```typescript
// Antes (linha 121)
.select('*')

// Depois - excluir campos pesados (result, step_results, payload)
.select(`
  id,
  agent_id,
  task_type,
  target_id,
  target_type,
  status,
  priority,
  error_message,
  execution_time_ms,
  created_at,
  started_at,
  completed_at,
  expires_at,
  timeout_at
`)
```

Isso reduz de **79 MB para ~50 KB** na listagem.

#### 2.2 Atualizar interface `AgentTask`

Tornar `payload`, `result` e `step_results` opcionais:

```typescript
interface AgentTask {
  // ... campos leves
  payload?: Json;      // Opcional
  result?: Json;       // Opcional  
  step_results?: Json; // Opcional
}
```

#### 2.3 Carregar dados pesados sob demanda no Dialog de detalhes

Modificar `openDetails` para buscar `result`, `step_results` e `payload` apenas quando o usuário clicar:

```typescript
const openDetails = async (task: AgentTask) => {
  setSelectedTask(task);
  setDetailsOpen(true);
  
  // Carregar dados pesados sob demanda
  if (!task.result) {
    const { data } = await supabase
      .from('agent_tasks')
      .select('result, step_results, payload')
      .eq('id', task.id)
      .single();
    
    if (data) {
      setSelectedTask({ ...task, ...data });
    }
  }
};
```

---

## Resultado Esperado

| Página | Antes | Depois | Melhoria |
|--------|-------|--------|----------|
| ReportsPage | ~450 MB timeout | ~5 KB | 99.99% |
| TaskExecutionsPage | 79 MB possível timeout | ~50 KB | 99.94% |

---

## Arquivos Modificados

1. `src/pages/ReportsPage.tsx`
2. `src/pages/firewall/TaskExecutionsPage.tsx`

## Complexidade

- Média - Refatoração de queries e carregamento sob demanda em 2 páginas

