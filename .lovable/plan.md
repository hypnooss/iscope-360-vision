

## Fix: Replicar padrão do Domain Compliance para M365 Compliance

### Diferença fundamental

**Domain Compliance (funciona):** Rastreia `agent_tasks` diretamente. Os status são terminais e claros: `pending` → `running` → `completed/failed/timeout`. Sem ambiguidade.

**M365 Compliance (quebrado):** Rastreia `m365_posture_history`, que pode ficar `partial` indefinidamente. Usa heurística complexa combinando `status` + `agent_status` para determinar se terminou, criando o loop detect → dismiss → re-detect.

### Solução

Replicar o padrão exato do Domain Compliance no M365PosturePage: rastrear a **agent_task** em vez do `m365_posture_history`.

### Mudanças em `src/pages/m365/M365PosturePage.tsx`

| Aspecto | Atual (quebrado) | Novo (padrão Domain) |
|---|---|---|
| **Estado** | `activeAnalysisId` (history ID) | `activeTaskId` (agent_task ID) |
| **Detecção on mount** | Query `m365_posture_history` com filtros complexos | Query `agent_tasks` WHERE `target_type = 'm365_posture'` AND `status IN ('pending','running')` |
| **Polling** | Polls `m365_posture_history.status` + `agent_status` | Polls `agent_tasks.status` — simples e terminal |
| **Finalização** | Heurística `status === partial && agent_status === failed` | `status IN ('completed','failed','timeout')` — inequívoco |
| **Trigger** | Salva `result.analysisId` | Salva `result.task_id` (já retornado pelo trigger) |

### Detalhamento

1. **Remover** `activeAnalysisId`, `analysisStartedAt`, `elapsed`, e a query `m365-active-analysis` que busca `m365_posture_history`
2. **Adicionar** `activeTaskId`, `taskStartedAt`, `isRefreshing` (mesmo padrão do Domain)
3. **Query de detecção** (mount): buscar `agent_tasks` com `target_type = 'm365_posture'`, `status IN ('pending','running')`, filtrado pelo tenant
4. **Query de polling**: buscar `agent_tasks.status` por `activeTaskId`, refetchInterval 15s
5. **Effect de finalização**: quando `status === completed/failed/timeout`, limpar estado e invalidar queries
6. **Safety timeout**: manter o timer de 10min existente
7. **handleRefresh**: salvar `task_id` retornado pelo trigger (já existe no response)
8. **Reset on tenant change**: limpar `activeTaskId`/`taskStartedAt`/`isRefreshing`
9. **Progress bar**: usar `isTaskRunning = !!activeTaskId && status IN ('pending','running')` em vez da lógica atual

### Por que funciona

- `agent_tasks` tem estados terminais claros — `completed`, `failed`, `timeout` — nunca ficam em limbo
- Sem heurística de combinação `status` + `agent_status`
- Mesmo registro que o Domain Compliance usa com sucesso
- Auto-cleanup de tasks expiradas já existe no trigger function

### Arquivo único a modificar

`src/pages/m365/M365PosturePage.tsx` — substituir o bloco de tracking (linhas 65-231) pelo padrão do Domain Compliance.

