

## Plano — Botão "Retry" para Jobs com Falha no Pipeline

### Resumo

Adicionar um botão de retry na tabela de jobs e no painel de detalhes, que reseta o job para reprocessamento pelo cron existente (`process-api-jobs`). Também criar uma Edge Function `retry-pipeline-job` para fazer o reset de forma segura no backend.

### Como funciona

Quando o admin clica em "Retry":
1. A Edge Function reseta o job: status volta para `queued`, limpa `error_message`, `completed_at`, e reseta os steps que falharam (e seus dependentes) para `pending`
2. O cron `process-api-jobs` pega o job novamente e continua do ponto onde parou

### Alterações

**1. Nova Edge Function `retry-pipeline-job`**

- Valida auth + admin role
- Recebe `job_id`, busca o job
- Só permite retry se status = `failed`
- Reseta: `status → queued`, limpa `error_message`, `completed_at`
- Percorre `steps[]`: steps com status `failed` voltam para `pending` (limpa `error`, `started_at`, `completed_at`, `result`). Steps que dependem de um step falhado também voltam para `pending`
- Steps `completed` permanecem intactos (não refaz trabalho já feito)

**2. Atualizar `ApiAccessManagement.tsx`**

- Adicionar `handleRetryJob(jobId)` que chama `retry-pipeline-job`
- Na coluna Ações, mostrar botão com ícone `RotateCcw` (lucide) quando `job.status === 'failed'`
- State `retryLoading` para feedback visual

**3. Atualizar `PipelineJobDetail.tsx`**

- Adicionar botão "Tentar Novamente" no header do sheet quando o job estiver com status `failed`
- Receber callback `onRetry` como prop

**4. Config + Deploy**

- Adicionar `retry-pipeline-job` ao `supabase/config.toml` com `verify_jwt = false`
- Deploy da função

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/retry-pipeline-job/index.ts` | Novo |
| `supabase/config.toml` | Adicionar entry |
| `src/components/admin/ApiAccessManagement.tsx` | Botão retry + handler |
| `src/components/admin/PipelineJobDetail.tsx` | Botão retry no detail |
| Deploy | `retry-pipeline-job` |

