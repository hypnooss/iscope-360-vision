
# Plano: Resolver Sobrecarga do Banco + Controle de Execução + Tela de Visualização

## Visao Geral do Problema

Os agents estao derrubando o banco de dados devido a:

1. Multiplas queries por heartbeat (3 operacoes por agent a cada 60s)
2. Queries N+1 no `agent-tasks` (ate 45 operacoes para 10 tarefas)
3. Processamento pesado no `agent-task-result` (ate 8 operacoes por resultado)
4. Instancia pequena do Supabase com limite baixo de conexoes (~10-20)

## Arquitetura da Solucao

```text
ANTES (Problematico)
--------------------
Agent -> Heartbeat (3 queries) -> Tasks (N+1 queries) -> Result (8 queries)
           |                            |                       |
           v                            v                       v
     [SELECT agents]           [SELECT tasks]           [SELECT agents]
     [UPDATE agents]           [SELECT firewall x N]    [SELECT tasks]
     [COUNT tasks]             [SELECT device_type x N] [SELECT firewall]
                               [SELECT blueprint x N]   [SELECT device_type]
                               [UPDATE tasks x N]       [SELECT rules]
                                                        [UPDATE task]
                                                        [INSERT history]
                                                        [UPDATE firewall]
                                                        [INSERT alert]
                                                        [COUNT tasks]

DEPOIS (Otimizado)
------------------
Agent -> Heartbeat (1 RPC) -> Tasks (2 queries max) -> Result (3-4 queries)
              |                       |                        |
              v                       v                        v
       [rpc_agent_heartbeat]   [SELECT com JOINs]        [Batch operations]
       (atomico, 1 round-trip)  [UPDATE batch]           [Transaction block]
```

---

## Fase 1: Otimizacao das Edge Functions

### 1.1 Criar RPC `rpc_agent_heartbeat`

**Arquivo: Migration SQL**

Uma funcao SQL que faz tudo atomicamente em 1 round-trip:

```sql
CREATE OR REPLACE FUNCTION rpc_agent_heartbeat(
  p_agent_id UUID,
  p_jwt_secret TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent RECORD;
  v_pending_count INTEGER;
  v_config_flag INTEGER;
BEGIN
  -- Buscar e validar agent em uma query
  SELECT id, jwt_secret, revoked, config_updated_at, config_fetched_at
  INTO v_agent
  FROM agents
  WHERE id = p_agent_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'AGENT_NOT_FOUND');
  END IF;
  
  IF v_agent.revoked THEN
    RETURN json_build_object('error', 'BLOCKED');
  END IF;
  
  IF v_agent.jwt_secret IS NULL THEN
    RETURN json_build_object('error', 'UNREGISTERED');
  END IF;
  
  -- Atualizar last_seen
  UPDATE agents SET last_seen = NOW() WHERE id = p_agent_id;
  
  -- Contar tarefas pendentes
  SELECT COUNT(*) INTO v_pending_count
  FROM agent_tasks
  WHERE agent_id = p_agent_id
    AND status = 'pending'
    AND expires_at > NOW();
  
  -- Calcular config_flag
  v_config_flag := CASE 
    WHEN v_agent.config_updated_at > COALESCE(v_agent.config_fetched_at, '1970-01-01')
    THEN 1 ELSE 0 
  END;
  
  RETURN json_build_object(
    'success', true,
    'agent_id', p_agent_id,
    'config_flag', v_config_flag,
    'has_pending_tasks', v_pending_count > 0,
    'next_heartbeat_in', 120 -- Aumentado para 120s
  );
END;
$$;
```

### 1.2 Reescrever `agent-heartbeat/index.ts`

**Arquivo: `supabase/functions/agent-heartbeat/index.ts`**

Mudancas:
- Usar RPC ao inves de 3 queries separadas
- Manter validacao JWT no Edge Function (seguranca)
- Retornar `next_heartbeat_in: 120` (dobrar intervalo)

### 1.3 Reescrever `agent-tasks/index.ts` com JOINs

**Arquivo: `supabase/functions/agent-tasks/index.ts`**

Mudancas principais:
- Substituir loop de SELECTs por single query com JOINs
- Batch UPDATE para marcar tasks como `running`
- Reduzir de ~45 queries para ~2 queries

```typescript
// ANTES: Loop N+1
for (const task of tasks) {
  await getTargetCredentials(supabase, task.target_id, task.target_type);
  await getDeviceBlueprint(supabase, deviceTypeId, task.task_type);
  await supabase.from('agent_tasks').update(...);
}

// DEPOIS: Query unica com JOINs
const { data: tasksWithData } = await supabase
  .from('agent_tasks')
  .select(`
    id, task_type, target_id, target_type, payload, priority, expires_at,
    firewalls!inner(id, fortigate_url, api_key, auth_username, auth_password, device_type_id),
    device_blueprints(collection_steps)
  `)
  .eq('agent_id', agentId)
  .eq('status', 'pending');

// Batch update
const taskIds = tasksWithData.map(t => t.id);
await supabase
  .from('agent_tasks')
  .update({ status: 'running', started_at: new Date().toISOString() })
  .in('id', taskIds);
```

### 1.4 Otimizar `agent-task-result/index.ts`

**Arquivo: `supabase/functions/agent-task-result/index.ts`**

Mudancas:
- Combinar queries relacionadas
- Usar `select` com JOINs ao inves de queries separadas
- Remover COUNT final (desnecessario, agent ja sabe se tem mais tasks)

---

## Fase 2: Controle de Execucao e Timeouts

### 2.1 Adicionar campos na tabela `agent_tasks`

**Migration SQL:**

```sql
-- Adicionar campos de controle de execucao
ALTER TABLE agent_tasks 
ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS step_results JSONB,
ADD COLUMN IF NOT EXISTS timeout_at TIMESTAMP WITH TIME ZONE;

-- Trigger para auto-timeout de tarefas travadas
CREATE OR REPLACE FUNCTION auto_timeout_stuck_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Marcar tarefas running por mais de 15 minutos como timeout
  UPDATE agent_tasks
  SET status = 'timeout',
      error_message = 'Task excedeu tempo maximo de execucao',
      completed_at = NOW()
  WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '15 minutes';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Executar a cada heartbeat (via cron ou trigger)
```

### 2.2 Atualizar Python Agent para reportar tempo de execucao

**Arquivo: `python-agent/agent/tasks.py`**

Adicionar medicao de tempo:

```python
import time

def execute(self, task):
    start_time = time.time()
    # ... execucao ...
    execution_time_ms = int((time.time() - start_time) * 1000)
    
    return {
        'status': status,
        'result': results,
        'error_message': error_msg,
        'execution_time_ms': execution_time_ms
    }
```

### 2.3 Backoff Exponencial no Scheduler

**Arquivo: `python-agent/agent/scheduler.py`**

```python
class AgentScheduler:
    def __init__(self, initial_interval, task, logger):
        self.base_interval = initial_interval
        self.current_interval = initial_interval
        self.max_interval = 300  # 5 minutos maximo
        self.consecutive_errors = 0
        
    def start(self):
        while True:
            try:
                result = self.task()
                # Reset backoff on success
                self.consecutive_errors = 0
                self.current_interval = result or self.base_interval
            except Exception:
                self.consecutive_errors += 1
                # Backoff exponencial: 60 -> 120 -> 240 -> 300 (max)
                self.current_interval = min(
                    self.base_interval * (2 ** self.consecutive_errors),
                    self.max_interval
                )
            
            time.sleep(self.current_interval)
```

---

## Fase 3: Tela de Visualizacao de Execucoes

### 3.1 Nova Pagina: `TaskExecutionsPage.tsx`

**Arquivo: `src/pages/firewall/TaskExecutionsPage.tsx`**

Funcionalidades:
- Listagem de todas as tarefas (agent_tasks)
- Filtros por status, agent, firewall
- Visualizacao de detalhes (steps executados, tempo, erros)
- Acoes: cancelar tarefa pendente, re-executar tarefa falha

### 3.2 Componentes da Tela

```text
TaskExecutionsPage
├── TaskFilters (status, agent, firewall, date range)
├── TaskStatsCards (total, pending, running, completed, failed, timeout)
├── TasksTable
│   ├── Colunas: Firewall, Agent, Status, Criado, Tempo, Acoes
│   └── Expandable: Step results, Error details
├── TaskDetailDialog
│   ├── Info basica
│   ├── Timeline de steps
│   └── Raw data (JSON viewer)
└── Acoes
    ├── Cancelar (pending only)
    ├── Re-executar (failed/timeout)
    └── Ver Analise (completed)
```

### 3.3 Adicionar Rota e Menu

**Arquivo: `src/App.tsx`**
```typescript
<Route path="/scope-firewall/executions" element={<TaskExecutionsPage />} />
```

**Arquivo: `src/components/layout/AppLayout.tsx`**
```typescript
'scope_firewall': {
  items: [
    { label: 'Firewalls', href: '/scope-firewall/firewalls', icon: Server },
    { label: 'Execucoes', href: '/scope-firewall/executions', icon: Activity },
    { label: 'Relatorios', href: '/scope-firewall/reports', icon: FileText },
  ],
}
```

---

## Fase 4: Aumentar Intervalo de Heartbeat

### 4.1 Atualizar Config Padrao

**Arquivo: `python-agent/agent/config.py`**

```python
POLL_INTERVAL = int(os.getenv("AGENT_POLL_INTERVAL", "120"))  # 60 -> 120
```

### 4.2 Resposta do Heartbeat

O `agent-heartbeat` ja retorna `next_heartbeat_in` que sera respeitado pelo agent.

---

## Resumo de Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migration SQL | Criar | RPC `rpc_agent_heartbeat` + campos de controle |
| `supabase/functions/agent-heartbeat/index.ts` | Modificar | Usar RPC, reduzir queries |
| `supabase/functions/agent-tasks/index.ts` | Modificar | Eliminar N+1 com JOINs |
| `supabase/functions/agent-task-result/index.ts` | Modificar | Combinar queries |
| `python-agent/agent/scheduler.py` | Modificar | Backoff exponencial |
| `python-agent/agent/tasks.py` | Modificar | Reportar tempo de execucao |
| `python-agent/agent/config.py` | Modificar | Aumentar intervalo padrao |
| `src/pages/firewall/TaskExecutionsPage.tsx` | Criar | Nova tela de execucoes |
| `src/components/layout/AppLayout.tsx` | Modificar | Adicionar item no menu |
| `src/App.tsx` | Modificar | Adicionar rota |

---

## Impacto Esperado

| Metrica | Antes | Depois | Reducao |
|---------|-------|--------|---------|
| Queries por heartbeat | 3 | 1 (RPC) | 67% |
| Queries por task fetch | 10-45 | 2 | 95% |
| Queries por task result | 8 | 3-4 | 50% |
| Intervalo heartbeat | 60s | 120s | 50% carga |
| **Carga total estimada** | 100% | ~15% | **85%** |

---

## Ordem de Implementacao

1. **Migration SQL** - Criar RPC e campos de controle
2. **Edge Functions** - Otimizar heartbeat, tasks, task-result
3. **Python Agent** - Backoff, tempo de execucao, intervalo
4. **Frontend** - Tela de execucoes

---

## Detalhes Tecnicos: RPC vs Queries Separadas

A principal otimizacao e usar uma funcao SQL (RPC) que executa toda a logica do heartbeat em uma unica transacao:

```text
ANTES (3 round-trips):
Browser -> Edge Function -> SELECT agents -> Edge Function
                         -> UPDATE agents -> Edge Function  
                         -> COUNT tasks   -> Edge Function -> Response

DEPOIS (1 round-trip):
Browser -> Edge Function -> RPC rpc_agent_heartbeat -> Response
                              (tudo atomico no banco)
```

Isso reduz:
- Latencia de rede (3 -> 1 round-trip)
- Conexoes simultaneas (3 -> 1)
- Tempo de bloqueio de recursos

