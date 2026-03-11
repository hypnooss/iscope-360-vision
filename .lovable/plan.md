

## Diagnóstico: Race Condition entre Agent e Edge Function

### O problema real

Quando o Agent termina primeiro que a Edge Function, existe uma **race condition** no backend:

1. Agent termina em ~20s → `agent-task-result` lê `m365_posture_history.status` = `running` → decide "Graph API não está pronta" → salva apenas `agent_insights` + `agent_status: 'completed'`, **NÃO marca como completed**
2. Edge Function termina em ~1.8min → lê `agent_status` → pode ler `pending` (se a escrita do agent ainda não commitou) OU `completed`
3. Se a Edge Function lê `agent_status = 'completed'` → faz merge → marca `completed` ✅
4. Se a Edge Function lê `agent_status = 'pending'` (race) → marca como `partial` → **ninguém jamais faz o merge final** ❌

O cenário 4 é o bug: o registro fica `partial` para sempre, com `agent_status: 'completed'` e `insights` do Graph API, mas sem merge.

### Solução

Adicionar um **re-check after write** em ambos os lados para cobrir a race condition:

#### 1. `trigger-m365-posture-analysis/index.ts` (Edge Function)
Após escrever `status: 'partial'` (linha 336-349), fazer um re-read imediato de `agent_status`. Se agora for `completed`, fazer o merge e atualizar para `completed`:

```typescript
// After writing partial...
if (finalStatus === 'partial') {
  // Re-check: agent may have completed between our first read and write
  const { data: recheck } = await supabaseAdmin
    .from('m365_posture_history')
    .select('agent_status, agent_insights')
    .eq('id', historyRecord.id)
    .maybeSingle();
  
  if (recheck?.agent_status === 'completed' && Array.isArray(recheck.agent_insights) && recheck.agent_insights.length > 0) {
    // Agent completed during our write — do the merge now
    const merged = [...allInsights, ...recheck.agent_insights];
    // recalculate score/summary with merged data...
    await supabaseAdmin.from('m365_posture_history')
      .update({ status: 'completed', completed_at: new Date().toISOString(), ... })
      .eq('id', historyRecord.id);
  }
}
```

#### 2. `agent-task-result/index.ts` (Agent handler)
Após salvar `agent_insights` + `agent_status: 'completed'` sem marcar completed (linha 5024-5029), fazer um re-read de `status`. Se agora for `partial` (Edge Function completou entre o read e write do agent), fazer o merge:

```typescript
// After saving agent_insights only...
if (!graphApiCompleted) {
  // Write agent data first
  await supabase.from('m365_posture_history').update(updatePayload).eq('id', analysisId);
  
  // Re-check: Edge Function may have completed and set 'partial' between our read and write
  const { data: recheck } = await supabase
    .from('m365_posture_history')
    .select('status, insights, score')
    .eq('id', analysisId)
    .maybeSingle();
  
  if (recheck?.status === 'partial' && Array.isArray(recheck.insights) && recheck.insights.length > 0) {
    // Edge Function completed — do the merge now
    const merged = [...recheck.insights, ...agentInsights];
    // recalculate and update to completed...
  }
}
```

#### 3. UI — `M365PosturePage.tsx`
Adicionar `'partial'` na lista de status que o polling de `m365_posture_history` trata como "ainda em andamento", e **não limpar a barra de progresso** quando o agent_task completa se o `m365_posture_history` ainda não for `completed`. Assim a UI espera pelo merge final:

- Quando `activeTaskId` completa, verificar `m365_posture_history.status` antes de limpar
- Se `status !== 'completed'`, trocar tracking para `activeAnalysisId` (continuar monitorando o history record)
- Só limpar tudo quando o history record chegar a `completed`

### Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/functions/trigger-m365-posture-analysis/index.ts` | Re-check `agent_status` após escrever `partial` |
| `supabase/functions/agent-task-result/index.ts` | Re-check `status` após salvar `agent_insights` sem completar |
| `src/pages/m365/M365PosturePage.tsx` | Transição agent_task→history tracking quando task completa mas history não |

