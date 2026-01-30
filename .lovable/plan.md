
Contexto e diagnóstico (o que eu já confirmei)
- Você relatou: o banner de alertas aparece, porém só depois de trocar de página ou dar refresh. Em produção.
- No frontend, o banner de alertas é o componente `src/components/alerts/SystemAlertBanner.tsx`, renderizado no topo do `AppLayout` (então ele está montado durante navegação).
- O componente cria uma assinatura Realtime via `supabase.channel(...).on('postgres_changes', ...)` e, quando recebe um evento, chama `fetchActiveAlerts()`.

O ponto crítico que explica “não é em tempo real”
- Para o Realtime “postgres_changes” funcionar, a tabela precisa estar no publication `supabase_realtime` do Postgres.
- Existe uma migration no repo dizendo isso:
  - `supabase/migrations/20260125224356_00fcfaf4-323d-40b4-a6dd-fdb5a098590f.sql`
  - Conteúdo: `ALTER PUBLICATION supabase_realtime ADD TABLE public.system_alerts;`
- Porém, eu consultei o banco atual (ambiente onde o Lovable está conectado no momento) e a tabela `system_alerts` NÃO está no publication:
  - Query executada: `select ... from pg_publication_tables where pubname='supabase_realtime' and tablename='system_alerts';`
  - Resultado: vazio (`[]`)
- Isso significa que, na prática, o Supabase Realtime não está emitindo eventos dessa tabela para o client, então o `.on('postgres_changes', ...)` nunca dispara. Por isso o banner só “atualiza” quando alguma ação força uma nova consulta (troca de rota, refresh, etc).

Objetivo da correção
1) Garantir que `public.system_alerts` esteja no publication `supabase_realtime` (no banco do Supabase) de forma idempotente e segura.
2) Tornar o `SystemAlertBanner` mais robusto:
   - logs de diagnóstico (status de subscribe) para facilitar suporte
   - fallback automático (polling) caso o Realtime não conecte (principalmente útil em produção e em ambientes com WebSocket bloqueado)

Plano de implementação (o que eu vou fazer em modo de edição)
A) Banco de dados (migração)
- Criar uma nova migration SQL idempotente que:
  1. Verifica se `public.system_alerts` já está no `pg_publication_tables` para `supabase_realtime`
  2. Só executa `ALTER PUBLICATION supabase_realtime ADD TABLE public.system_alerts;` se estiver faltando
  3. (Opcional, recomendado) Garantir `REPLICA IDENTITY` adequado:
     - Como a tabela tem PK `id`, normalmente já basta para UPDATE/DELETE. Ainda assim, posso configurar `REPLICA IDENTITY FULL` se você quiser garantir que payloads de UPDATE sempre venham completos (trade-off: maior volume de dados em updates). Vou deixar como decisão técnica conservadora: manter default, e só ajustar se for necessário.
- Após a migration, validar no banco com a mesma query do publication.

Importante sobre “produção”
- Como você disse que o problema está em produção, o ideal é:
  - aplicar a migration e publicar para produção; ou
  - se quiser corrigir imediatamente sem esperar publish, eu posso te dar a query para você rodar no Supabase SQL Editor com o ambiente Live selecionado (mas a execução manual fica por sua conta).

B) Frontend (robustez do realtime)
- Ajustar `SystemAlertBanner.tsx` para:
  1. Registrar status do canal (callback do `.subscribe(status => ...)`), para sabermos se está “SUBSCRIBED”, “TIMED_OUT”, “CLOSED”, etc.
  2. Ao entrar em `SUBSCRIBED`, chamar `fetchActiveAlerts()` (garante sincronização inicial assim que o websocket conecta).
  3. Implementar fallback: se não estiver `SUBSCRIBED` após X segundos (ex.: 5–10s), iniciar polling leve (ex.: a cada 30s) até a conexão estabilizar; ao estabilizar, parar polling.
  4. Garantir cleanup correto:
     - remover canal no unmount
     - limpar interval do polling
- Ajuste de escopo do evento:
  - Manteremos `event: '*'` se você quer que o banner reflita inserts/updates (ex.: dismiss), mas posso reduzir para `INSERT`+`UPDATE` para diminuir ruído, se preferir.

C) Validação / teste end-to-end
- Teste rápido guiado:
  1. Com o app aberto, gerar um alerta novo (ex.: finalizar uma task de agent que cria alertas; ou inserir manualmente um registro em `system_alerts` com `is_active=true`)
  2. Verificar se o banner aparece sem refresh
  3. Verificar se ao “dispensar” (X) o banner some e não volta
  4. Checar console: deve mostrar status “SUBSCRIBED” e logs de mudança chegando

Riscos e observações
- Mesmo com publication correto, o Realtime pode falhar em algumas redes (proxy corporativo bloqueando websocket). O fallback por polling garante que o banner continue “quase real-time” (ex.: 30s) em ambientes restritos.
- Como a sua base tem RLS, mas a assinatura de `postgres_changes` não depende das policies para “receber o evento”; o que depende de RLS é a leitura do dado via `fetchActiveAlerts()`. Como o usuário já enxerga alertas após refresh, as políticas parecem ok para o seu papel (super_admin/workspace_admin).

Checklist do que será alterado (arquivos)
- Banco:
  - Nova migration em `supabase/migrations/` (para garantir publication).
- Frontend:
  - `src/components/alerts/SystemAlertBanner.tsx` (melhorias de subscribe + fallback + logs).

Critério de aceite (resultado esperado)
- Um alerta criado por automação (agent / M365) aparece no topo do app automaticamente, sem refresh e sem trocar de rota.
- Ao dispensar um alerta, ele some e não reaparece.
- Console mostra a assinatura estabelecida (SUBSCRIBED) e eventos chegando.

Próximo passo
- Eu vou executar primeiro a correção do publication via migration (idempotente) e depois ajustar o `SystemAlertBanner` para logs + fallback. Em seguida, validamos o comportamento no seu fluxo real (criação de alertas por task/tenant).
