

## Plano — Botão de reenvio de email report na tabela de Jobs/Pipeline

### Resumo

Adicionar um botão "Reenviar Report" em cada linha de job concluído na tabela de Jobs/Pipeline (`ApiAccessManagement.tsx`). Ao clicar, o sistema re-executa a lógica de `stepEmailReport` — gerando novo `access_token` e reenviando o email com os dados atualizados.

### Alterações

**1. Criar Edge Function `resend-pipeline-report`**

Arquivo: `supabase/functions/resend-pipeline-report/index.ts`

- Recebe `{ job_id }` no body
- Valida que o job existe e está `completed`
- Reutiliza a mesma lógica de `stepEmailReport`: busca domain, analysis, snapshot, gera novo `access_token`, monta `templateData` e chama `send-transactional-email`
- Usa uma nova `idempotencyKey` (ex: `resend-report-${job_id}-${Date.now()}`) para permitir reenvios múltiplos
- Requer auth (service_role ou JWT de admin)

**2. Atualizar `ApiAccessManagement.tsx`**

- Adicionar coluna "Ações" na tabela de Jobs
- Para jobs com `status === 'completed'` e que possuem step `email_report`, mostrar botão com ícone `Mail` (lucide) + tooltip "Reenviar Report"
- Ao clicar, chama `supabase.functions.invoke('resend-pipeline-report', { body: { job_id } })`
- Mostra loading no botão durante o envio, toast de sucesso/erro após

### Detalhes técnicos

- A Edge Function extrai `email_to` do `metadata.email_to` do job (mesmo campo usado originalmente)
- O `access_token` é regenerado a cada reenvio para invalidar links anteriores
- A idempotency key inclui timestamp para não ser bloqueada como duplicata

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/resend-pipeline-report/index.ts` | Novo |
| `src/components/admin/ApiAccessManagement.tsx` | Atualizar — adicionar coluna Ações com botão reenviar |

