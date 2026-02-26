
Objetivo: eliminar o estado “zumbi” (análise travada em andamento) no M365 Analyzer e impedir recorrência.

1) Diagnóstico confirmado no ambiente atual
- Tenant atual: `f1f3db2b-13ed-48b8-b005-97ec4d2ed0a0`.
- Snapshot zumbi encontrado:
  - `snapshot_id`: `a52bc061-4498-469b-a6de-07c4373debc9`
  - `snapshot_status`: `pending`
  - `agent_task_id`: `9ddb1b86-6f90-4ab3-8cf4-8f7db3e121cd`
- A task vinculada já está terminal:
  - `task_status`: `completed`
  - `completed_at`: `2026-02-26 17:07:05.65+00`
- Conclusão: a UI fica em “Em andamento” porque o progresso hoje depende do status do snapshot mais recente; como ele ficou `pending`, o botão de execução permanece bloqueado.

2) Causa raiz
- Há inconsistência de estado entre `agent_tasks` e `m365_analyzer_snapshots`.
- Mesmo com `agent_tasks.status = completed`, o snapshot pode permanecer `pending/processing` (cenário típico de execução anterior sem reconciliação).
- Não existe um mecanismo de “auto-heal” para snapshots órfãos/terminais inconsistentes.
- Em `m365-analyzer`, o `catch` global retorna erro mas não força atualização do snapshot para `failed`, o que também pode deixar execução travada em falha inesperada.

3) Ação imediata para “matar a zumbi” (operacional)
- Executar cleanup pontual do snapshot travado para sair de “Em andamento”.
- SQL operacional (no editor SQL):
```sql
update m365_analyzer_snapshots
set status = 'failed',
    metrics = coalesce(metrics, '{}'::jsonb) || jsonb_build_object('recovered_reason', 'orphan_snapshot_task_completed')
where id = 'a52bc061-4498-469b-a6de-07c4373debc9'
  and status in ('pending','processing');
```
- Resultado esperado imediato: a página deixa de mostrar progresso infinito e volta a permitir nova execução.

4) Correção definitiva no código (hardening)
- Arquivo: `src/hooks/useM365AnalyzerData.ts`
  - Ajustar `useM365AnalyzerProgress` para consultar também o status da `agent_task_id` associada.
  - Regra de execução: considerar “em andamento” apenas quando snapshot e task estiverem coerentes em estado ativo.
  - Se snapshot estiver `pending/processing` e task estiver terminal (`completed/failed/timeout/cancelled`), retornar estado reconciliado (não-running) para destravar UI.

- Arquivo: `supabase/functions/trigger-m365-analyzer/index.ts`
  - Antes de validar `ALREADY_RUNNING`, adicionar reconciliação de snapshots inconsistentes:
    - snapshots `pending/processing` cujo `agent_task_id` esteja terminal ou expirado devem ir para `failed` (com motivo em `metrics`).
  - Isso evita bloqueio por snapshot órfão ao iniciar nova análise.

- Arquivo: `supabase/functions/m365-analyzer/index.ts`
  - No `catch` global, garantir atualização do snapshot para `failed` quando houver erro não tratado após entrar em processamento.
  - Incluir `metrics.error` para rastreabilidade.

- Arquivo: `src/pages/m365/M365AnalyzerDashboardPage.tsx`
  - Exibir aviso quando houver estado inconsistente detectado (ex.: “execução anterior encerrada com inconsistência”).
  - Adicionar ação de “Atualizar estado” (refetch + invalidate) e permitir “Executar Análise” quando reconciliado.

5) Validação após implementação
- Cenário A (cleanup atual): snapshot zumbi marcado como `failed` e botão “Executar Análise” liberado.
- Cenário B (nova execução): trigger cria novo snapshot/task; progresso muda de pending/processing para completed sem ficar preso.
- Cenário C (falha forçada): erro no `m365-analyzer` deve terminar snapshot em `failed` (sem loop infinito).
- Cenário D (consistência): nenhuma linha de `m365_analyzer_snapshots` em `pending/processing` com `agent_tasks` terminal para o tenant.

6) Arquivos impactados
- `src/hooks/useM365AnalyzerData.ts`
- `supabase/functions/trigger-m365-analyzer/index.ts`
- `supabase/functions/m365-analyzer/index.ts`
- `src/pages/m365/M365AnalyzerDashboardPage.tsx`

7) Risco e mitigação
- Risco baixo/médio: mudança de regra de progresso pode alterar comportamento visual de execução.
- Mitigação: manter critério conservador (somente running quando task ativa), logs explícitos e validação com tenant real em sequência curta de testes.
