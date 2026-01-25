

# Plano: Coleta Fragmentada para Agent Genérico

## Resumo Executivo

Implementar um modelo de **coleta e envio progressivo** onde o Agent envia os dados de cada step imediatamente após sua execução, ao invés de acumular todos os 25MB e enviar de uma só vez.

## Problema Atual

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        MODELO ATUAL (Batch)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Agent                                                                  │
│  ├── Step 1: GET /system/status     → acumula ~500KB                   │
│  ├── Step 2: GET /firewall/policy   → acumula ~15MB                    │
│  ├── Step 3: GET /firewall/address  → acumula ~8MB                     │
│  ├── ... (16 steps restantes)                                           │
│  └── POST /agent-task-result        → envia ~25MB de uma vez (27s)     │
│                                                                         │
│  Riscos:                                                                │
│  - Timeout no upload (>60s)                                             │
│  - Pico de memória no Agent (~25MB)                                     │
│  - Pico de memória no Edge Function                                     │
│  - Instabilidade de infraestrutura (Error 522)                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Solução Proposta

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     MODELO NOVO (Streaming Progressivo)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Agent                                                                  │
│  ├── Step 1: GET /system/status                                        │
│  │   └── POST /agent-step-result (step_id, data ~500KB) ✓              │
│  ├── Step 2: GET /firewall/policy                                      │
│  │   └── POST /agent-step-result (step_id, data ~15MB) ✓               │
│  ├── Step 3: GET /firewall/address                                     │
│  │   └── POST /agent-step-result (step_id, data ~8MB) ✓                │
│  ├── ... (cada step envia imediatamente)                               │
│  └── POST /agent-task-complete (task_id, summary ~1KB)                 │
│                                                                         │
│  Benefícios:                                                            │
│  - Uploads pequenos (~1-15MB cada)                                      │
│  - Sem acumulação de memória                                            │
│  - Resiliência: falha parcial preserva dados coletados                 │
│  - Backend processa incrementalmente                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Novo Endpoint Edge Function: `agent-step-result`

Recebe o resultado de um único step e armazena temporariamente.

**Arquivo:** `supabase/functions/agent-step-result/index.ts`

```typescript
interface StepResultRequest {
  task_id: string;
  step_id: string;
  status: 'success' | 'failed' | 'skipped';
  data?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
}

// Comportamento:
// 1. Valida token do Agent
// 2. Verifica ownership da task
// 3. Insere em nova tabela 'task_step_results' (task_id, step_id, data, status)
// 4. Retorna { success: true, steps_completed: N, steps_total: M }
```

### 2. Nova Tabela: `task_step_results`

Armazena resultados intermediários por step.

```sql
CREATE TABLE task_step_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  data JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(task_id, step_id)
);

-- Índice para busca rápida
CREATE INDEX idx_task_step_results_task_id ON task_step_results(task_id);

-- RLS: apenas backend pode acessar via service_role
ALTER TABLE task_step_results ENABLE ROW LEVEL SECURITY;
```

### 3. Refatorar `agent-task-result` para `agent-task-complete`

O endpoint final agora apenas sinaliza conclusão e dispara o processamento.

**Modificações em:** `supabase/functions/agent-task-result/index.ts`

```typescript
// ANTES: Recebe ~25MB de raw_data
interface TaskResultRequest {
  task_id: string;
  status: 'completed' | 'failed';
  result?: Record<string, unknown>;  // 25MB aqui
}

// DEPOIS: Recebe apenas metadados (~1KB)
interface TaskCompleteRequest {
  task_id: string;
  status: 'completed' | 'failed' | 'partial';
  execution_time_ms: number;
  steps_completed: number;
  steps_failed: number;
  error_message?: string;
}

// O processamento busca dados de task_step_results:
const { data: stepResults } = await supabase
  .from('task_step_results')
  .select('step_id, data, status')
  .eq('task_id', taskId)
  .eq('status', 'success');

// Reconstrói raw_data a partir dos steps
const rawData = {};
for (const step of stepResults) {
  rawData[step.step_id] = step.data;
}

// Processa compliance rules normalmente
const complianceResult = processComplianceRules(rawData, rules);
```

### 4. Modificar Python Agent: `tasks.py`

Adicionar envio progressivo após cada step.

**Arquivo:** `python-agent/agent/tasks.py`

```python
def execute(self, task: Dict[str, Any]) -> Dict[str, Any]:
    task_id = task.get('id')
    steps = task.get('steps', [])
    
    for i, step in enumerate(steps):
        step_id = step.get('id')
        step_start = time.time()
        
        # Executar step
        result = executor.run(step, context)
        duration_ms = int((time.time() - step_start) * 1000)
        
        # NOVO: Enviar resultado imediatamente
        self._report_step_result(task_id, step_id, result, duration_ms)
        
        # Limpar memória após envio
        del result
    
    # Ao final, apenas sinaliza conclusão
    return self._finalize_task(task_id, stats)

def _report_step_result(self, task_id, step_id, result, duration_ms):
    """Envia resultado de um step para o backend."""
    payload = {
        'task_id': task_id,
        'step_id': step_id,
        'status': 'success' if not result.get('error') else 'failed',
        'data': result.get('data'),
        'error': result.get('error'),
        'duration_ms': duration_ms
    }
    self.api.post('/agent-step-result', json=payload)
```

### 5. Adicionar `config.toml` para novo endpoint

**Arquivo:** `supabase/config.toml`

```toml
[functions.agent-step-result]
verify_jwt = false
```

### 6. Limpeza Automática de Steps Temporários

Trigger para limpar `task_step_results` após processamento.

```sql
-- Ao completar task, limpar steps após 24h (manter para debug)
CREATE OR REPLACE FUNCTION cleanup_completed_task_steps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed', 'timeout') THEN
    -- Agendar limpeza (não bloquear o update)
    PERFORM pg_notify('cleanup_task_steps', NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Diagrama de Sequência

```text
┌────────┐          ┌───────────────────┐          ┌──────────────────┐
│ Agent  │          │ agent-step-result │          │ task_step_results│
└───┬────┘          └─────────┬─────────┘          └────────┬─────────┘
    │                         │                              │
    │ Execute Step 1          │                              │
    ├─────────────────────────>                              │
    │ POST step_id=system_status, data=500KB                 │
    │                         ├──────────────────────────────>
    │                         │ INSERT (task_id, step_id, data)
    │<─ OK (1/19 complete)────┤                              │
    │                         │                              │
    │ Execute Step 2          │                              │
    ├─────────────────────────>                              │
    │ POST step_id=firewall_policy, data=15MB                │
    │                         ├──────────────────────────────>
    │                         │ INSERT                       │
    │<─ OK (2/19 complete)────┤                              │
    │                         │                              │
    │ ... (17 more steps) ... │                              │
    │                         │                              │
┌───┴────┐          ┌─────────┴─────────┐                    │
│ Agent  │          │ agent-task-complete│                   │
└───┬────┘          └─────────┬─────────┘                    │
    │                         │                              │
    │ POST task_complete      │                              │
    │ (only metadata ~1KB)    │                              │
    ├─────────────────────────>                              │
    │                         │ SELECT * FROM task_step_results
    │                         │<─────────────────────────────┤
    │                         │ Reconstruct raw_data         │
    │                         │ Process compliance_rules     │
    │                         │ Save to analysis_history     │
    │<─ OK (score: 58%) ──────┤                              │
    │                         │                              │
```

## Benefícios da Solução

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Tamanho máximo de upload | 25MB (uma vez) | ~15MB (maior step) |
| Pico de memória Agent | 25MB | ~15MB |
| Risco de timeout | Alto (27s upload) | Baixo (distribuído) |
| Resiliência a falhas | Perde tudo | Preserva steps completos |
| Tempo total estimado | ~30s | ~40s (overhead de requests) |
| Recuperação de falhas | Reiniciar do zero | Continuar do último step |

## Compatibilidade

A solução mantém retrocompatibilidade:
- O endpoint `agent-task-result` original continuará funcionando para Agents que não suportam streaming
- Novos Agents detectam se backend suporta `/agent-step-result` e usam modo progressivo

## Ordem de Implementação

1. Criar tabela `task_step_results` (migração SQL)
2. Criar edge function `agent-step-result`
3. Modificar `agent-task-result` para suportar reconstrução de dados
4. Atualizar Python Agent para envio progressivo
5. Testar end-to-end com FortiGate SAO-FW
6. Adicionar limpeza automática de steps antigos

