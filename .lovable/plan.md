

## Diagnóstico — O que falta no Supabase para o email funcionar

O domínio `notify.domainsecurity.online` está **verificado e ativo**. As Edge Functions (`send-transactional-email`, `handle-email-unsubscribe`, etc.) já existem no código. Porém, **toda a infraestrutura de banco de dados necessária está ausente**:

### O que está faltando

| Componente | Status |
|---|---|
| Tabela `email_send_log` | ❌ Não existe |
| Tabela `email_send_state` | ❌ Não existe |
| Tabela `suppressed_emails` | ❌ Não existe |
| Tabela `email_unsubscribe_tokens` | ❌ Não existe |
| Extensão `pgmq` | ❌ Não instalada |
| Filas pgmq (`auth_emails`, `transactional_emails`) | ❌ Não existem |
| RPCs (`enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq`) | ❌ Não existem |
| Vault secret `email_queue_service_role_key` | ❌ Não existe |
| Cron job `process-email-queue` | ❌ Não existe |
| Edge Function `process-email-queue` | ❌ Não deployada |

**Resumo**: O pipeline chama `send-transactional-email`, que tenta chamar `enqueue_email` para colocar o email na fila — mas a RPC não existe, então falha silenciosamente. Mesmo que a RPC existisse, não há cron job para drenar a fila e efetivamente enviar os emails.

### Plano de correção

1. **Chamar `setup_email_infra`** — cria automaticamente todas as tabelas, extensão pgmq, filas, RPCs, vault secret e cron job
2. **Deployer `process-email-queue`** — a Edge Function que drena a fila e envia os emails de fato
3. **Re-deployer `send-transactional-email`** — para garantir que o código mais recente está ativo
4. **Verificar** que o cron job `process-email-queue` foi criado e está rodando a cada 5 segundos

Nenhuma mudança de código é necessária — apenas provisionar a infraestrutura que deveria ter sido criada nas tentativas anteriores (que aparentemente falharam ou não foram executadas).

### Arquivos/componentes envolvidos

| Ação | Detalhe |
|---|---|
| `setup_email_infra` (tool) | Cria toda a infra de banco |
| Deploy `process-email-queue` | Edge Function do dispatcher |
| Deploy `send-transactional-email` | Re-deploy para garantir versão atual |

