
# Plano: Arquitetura Dual-Task para M365 (Graph API + Agent)

## Problema Identificado

O `trigger-m365-posture-analysis` atualmente:
1. Cria registro em `m365_posture_history`
2. Chama `m365-security-posture` (que usa apenas Graph API)
3. **Não cria tarefa para o agent** executar coletas PowerShell

O blueprint "M365 - Exchange & SharePoint (Agent)" foi criado mas nunca é acionado automaticamente.

## Solução Proposta

Refatorar o fluxo de análise M365 para disparar **duas tarefas paralelas**:

```text
┌─────────────────────────────────────────────────────────────────┐
│                trigger-m365-posture-analysis                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
┌──────────────────────┐       ┌──────────────────────────────────┐
│  m365-security-posture│       │      agent_tasks                 │
│  (Graph API via Edge) │       │  (PowerShell via Agent)          │
│                       │       │                                   │
│  • 39 steps Graph     │       │  • 16 steps PowerShell           │
│  • Identidades        │       │  • Exchange: Mailboxes, Rules    │
│  • Auth, CA Policies  │       │  • SharePoint: Tenant, Sites     │
│  • Risk Detections    │       │  • Coletas via CBA               │
└──────────┬────────────┘       └──────────────┬────────────────────┘
           │                                   │
           │  Resultado imediato               │  Resultado async
           ▼                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     m365_posture_history                          │
│                                                                   │
│  • insights (Graph API)                                           │
│  • agent_insights (PowerShell) ← NOVO CAMPO                      │
│  • score combinado                                                │
└──────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

### 1. Edge Function: `trigger-m365-posture-analysis/index.ts`

Adicionar lógica para criar tarefa do agente:

```typescript
// Após criar historyRecord...

// 1. Verificar se tenant tem agent vinculado
const { data: tenantAgent } = await supabaseAdmin
  .from('m365_tenant_agents')
  .select('agent_id')
  .eq('tenant_record_id', tenant_record_id)
  .eq('enabled', true)
  .maybeSingle();

// 2. Se tiver agent, criar task de PowerShell
if (tenantAgent?.agent_id) {
  const { data: agentTask } = await supabaseAdmin
    .from('agent_tasks')
    .insert({
      agent_id: tenantAgent.agent_id,
      task_type: 'm365_powershell',
      target_id: tenant_record_id,
      target_type: 'm365_tenant',
      status: 'pending',
      priority: 5,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      payload: {
        analysis_id: historyRecord.id,  // Link com a análise
        blueprint_type: 'exchange_sharepoint',
        commands: [...] // Blueprint completo de 16 steps
      }
    })
    .select('id')
    .single();

  console.log(`Agent task created: ${agentTask?.id}`);
}

// 3. Continuar com análise Graph API normalmente...
EdgeRuntime.waitUntil(runAnalysis());
```

### 2. Banco de Dados: Nova coluna em `m365_posture_history`

```sql
ALTER TABLE m365_posture_history 
ADD COLUMN agent_task_id uuid REFERENCES agent_tasks(id),
ADD COLUMN agent_insights jsonb DEFAULT NULL,
ADD COLUMN agent_status text DEFAULT NULL;
```

### 3. Edge Function: `agent-task-result/index.ts`

Atualizar para persistir resultados em `m365_posture_history`:

```typescript
// Quando task é de tipo m365_tenant...
if (task.target_type === 'm365_tenant' && task.payload?.analysis_id) {
  // Atualizar m365_posture_history com os insights do agent
  await supabase
    .from('m365_posture_history')
    .update({
      agent_insights: processedInsights,
      agent_status: result.status,
    })
    .eq('id', task.payload.analysis_id);
}
```

### 4. RPC Function: `rpc_get_agent_tasks`

Já está configurada corretamente para gerar steps a partir de blueprints M365. Verificado que funciona (tarefa `dcfdcbfe...` executou com sucesso).

### 5. Frontend: `M365PosturePage.tsx`

Exibir insights combinados (Graph + Agent):

```typescript
// Combinar insights de ambas as fontes
const allInsights = [
  ...(postureData?.insights || []),           // Graph API
  ...(postureData?.agent_insights || []),     // PowerShell/Agent
];
```

## Fluxo de Execução Completo

1. **Usuário clica "Analisar"** → `trigger-m365-posture-analysis`
2. **Cria registro** em `m365_posture_history` com status `pending`
3. **Verifica agent vinculado** em `m365_tenant_agents`
4. **Se houver agent**:
   - Cria `agent_task` com `target_type: m365_tenant`
   - Payload inclui `analysis_id` para vincular
5. **Executa análise Graph API** em background (Edge Function)
6. **Agent processa task** quando disponível
7. **agent-task-result** atualiza `m365_posture_history.agent_insights`
8. **UI exibe resultados combinados**

## Benefícios

1. **Paralelismo**: Graph API e Agent executam simultaneamente
2. **Independência**: Se agent não estiver disponível, Graph API ainda funciona
3. **Rastreabilidade**: `analysis_id` liga tudo ao mesmo registro histórico
4. **Escalabilidade**: Cada executor trabalha em seu domínio

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/trigger-m365-posture-analysis/index.ts` | Adicionar criação de task do agent |
| `supabase/functions/agent-task-result/index.ts` | Persistir insights em `m365_posture_history` |
| Migração SQL | Adicionar colunas `agent_task_id`, `agent_insights`, `agent_status` |
| `src/pages/m365/M365PosturePage.tsx` | Exibir insights combinados |
| `src/hooks/useM365SecurityPosture.ts` | Buscar `agent_insights` também |

## Considerações de Segurança

- Task do agent usa CBA (Certificate-Based Auth) - já implementado
- Dados coletados são armazenados em `task_step_results` com RLS
- `m365_posture_history` já tem políticas RLS apropriadas
