

## Diagnóstico: M365 Compliance com Score 100 e dados incompletos

### O que aconteceu

A análise do dia 09/03 (ID `f0bc6d03`) completou com **0 insights da Graph API** e **14 insights do Agent PowerShell**. O score ficou 100 porque os 14 itens do agent são quase todos `pass` ou `info`.

**Causa raiz: Race condition no fluxo de análise.**

O fluxo atual é:
1. `trigger-m365-posture-analysis` cria o registro como `pending`
2. Dispara o Agent PowerShell (task separada)
3. Usa `EdgeRuntime.waitUntil()` para rodar a Graph API em background
4. O Agent completou em **19.5 segundos**
5. `agent-task-result` foi chamado, encontrou o registro ainda com `insights = []` (Graph API ainda não tinha salvado)
6. Marcou o registro como `completed` com score=100 (só agent insights)
7. Quando a Graph API finalizou (se finalizou), tentou salvar com `status: 'partial'`, mas o registro já estava `completed` — o update pode ter sido ignorado ou a Graph API crashou antes de salvar

**Confirmação**: A análise re-executada em 10/03 02:11 tem **54 insights Graph + 14 Agent = 68 total, score 75** — está correta e é o que o `get_posture_insights_lite` retorna agora (ordena por `completed_at DESC`).

### Estado atual

A tela de Compliance **já deve estar mostrando os dados corretos** (score 75, 68 insights) porque existe uma análise mais recente (10/03) que funcionou. Os screenshots foram tirados quando a análise mais recente era a de 09/03 (quebrada).

### Correção necessária: Prevenir a race condition

**Arquivo: `supabase/functions/agent-task-result/index.ts`** (bloco M365 tenant, ~linha 4970)

Antes de salvar os agent insights e marcar como `completed`, verificar se a Graph API já salvou seus insights. Se o registro ainda estiver com `status = 'pending'` ou `'running'` (Graph API não concluiu), o agent deve:
1. Salvar os `agent_insights` e `agent_status = 'completed'`
2. **NÃO** mudar o `status` geral para `completed` — manter o status atual
3. **NÃO** recalcular o score baseado apenas nos agent insights

E no `trigger-m365-posture-analysis`, quando a Graph API salva com `status: 'partial'`, verificar se `agent_status` já é `completed`. Se for, recalcular com ambos os conjuntos e marcar como `completed`.

Alternativamente (mais simples): no `agent-task-result`, se `existingRecord.insights` estiver vazio e o `status` não for `partial`, aguardar com retry ou apenas salvar agent_insights sem alterar status/score.

### Alterações propostas

**1. `supabase/functions/agent-task-result/index.ts`** (~linha 5007-5019)
- Antes de fazer update, checar `existingRecord` status via query separada
- Se `insights` estiver vazio (Graph API não salvou), salvar apenas `agent_insights` e `agent_status = 'completed'`, sem mudar `status` nem `score`
- Mover o cálculo de score e `status: 'completed'` para executar apenas quando `insights` já tem dados

**2. `supabase/functions/trigger-m365-posture-analysis/index.ts`** (~linha 278-291)
- Ao salvar os resultados da Graph API, verificar se `agent_status = 'completed'`
- Se sim, fazer merge com `agent_insights` existentes e marcar como `completed`
- Se não, salvar como `partial` (comportamento atual)

Isso garante que quem chegar por último (Graph ou Agent) faz o merge final e calcula o score correto.

