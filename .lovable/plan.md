

## Plano de Execução — Email Infrastructure + Report Template

O domínio `notify.domainsecurity.online` está verificado. O código do `stepEmailReport` no `process-api-jobs` já chama `send-transactional-email` com o template `domain-security-report`. Falta criar toda a infraestrutura.

### Passos

1. **Chamar `setup_email_infra`** — cria tabelas (email_send_log, email_send_state, suppressed_emails, email_unsubscribe_tokens), filas pgmq, cron job, e vault secrets

2. **Chamar `scaffold_transactional_email`** — cria as Edge Functions:
   - `send-transactional-email`
   - `handle-email-unsubscribe`
   - `handle-email-suppression`
   - Registry e template sample

3. **Criar template `domain-security-report.tsx`** em `_shared/transactional-email-templates/` com:
   - Nome do domínio, scores de compliance e attack surface
   - Breakdown de findings (critical/high/medium/low)
   - Stats de rede (IPs, portas, serviços, CVEs)
   - Data da análise
   - Estilo dark/profissional adaptado para email (fundo branco, acentos escuros)

4. **Registrar no `registry.ts`** — adicionar o template ao TEMPLATES map

5. **Criar página `/unsubscribe`** em `src/pages/Unsubscribe.tsx` + rota no `App.tsx`

6. **Deploy** de todas as Edge Functions: `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `process-email-queue`

### Arquivos Criados/Modificados

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/transactional-email-templates/domain-security-report.tsx` | Novo template |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Registrar template |
| `supabase/functions/send-transactional-email/index.ts` | Criado pelo scaffold |
| `supabase/functions/handle-email-unsubscribe/index.ts` | Criado pelo scaffold |
| `supabase/functions/handle-email-suppression/index.ts` | Criado pelo scaffold |
| `src/pages/Unsubscribe.tsx` | Página de unsubscribe |
| `src/App.tsx` | Rota `/unsubscribe` |

