
Diagnóstico: o pipeline terminou, mas o passo `email_report` não enviou nada. O último job salvo no banco mostra `email_failed` com erro `401: Invalid Token or Protected Header formatting`. Além disso, nesta base atual não existem as tabelas/RPCs da infraestrutura de app emails (`email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens`, `enqueue_email`) e também não existe cron `process-email-queue`. Ou seja: hoje há 2 bloqueios reais — a chamada protegida para o sender está falhando antes de executar, e a fila de emails nem está provisionada nesta instância.

Plano de correção:

1. Reprovisionar a infraestrutura de app emails nesta instância
- Criar a infraestrutura gerenciada de emails na base atual
- Confirmar criação das tabelas, RPCs da fila e do dispatcher agendado
- Garantir que o processador da fila exista e esteja ativo

2. Corrigir a autenticação entre `process-api-jobs` e `send-transactional-email`
- Ajustar o `stepEmailReport` para usar um caminho de invocação compatível com a proteção atual da função
- Se necessário, alinhar a configuração da função de envio com esse padrão
- Redeploy das funções envolvidas após o ajuste

3. Corrigir o status do pipeline para não mascarar falhas de email
- Hoje o engine marca qualquer step síncrono como `completed`, mesmo quando o resultado interno é `email_failed`
- Vou fazer o `email_report` marcar o step como falho quando o envio não for enfileirado/enviado corretamente
- Assim a UI deixa de mostrar o pipeline “verde” quando o email não saiu

4. Validar ponta a ponta
- Rodar um novo pipeline
- Confirmar que o passo `email_report` registra envio/enfileiramento corretamente
- Confirmar que a fila é drenada pelo dispatcher
- Verificar inbox do destinatário e o log de emails
- Se vocês também dependem do ambiente publicado/live, fazer publish novamente para garantir a infraestrutura de produção

Arquivos/áreas que devem entrar na implementação:
- `supabase/functions/process-api-jobs/index.ts`
- `supabase/functions/send-transactional-email/index.ts`
- Configuração/deploy das Edge Functions de email
- Infraestrutura gerenciada de app emails na base Supabase atual

Observação importante: pelos erros observados, isso não está parecendo problema de template nem do endereço do destinatário; a falha acontece antes da entrega real do email.
