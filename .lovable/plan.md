
Contexto do problema (o que está acontecendo)
- Você executou uma tarefa de coleta/validação e, ao finalizar, o banner não apareceu nem após atualizar a página.
- Hoje o banner (`SystemAlertBanner`) só mostra alertas para usuários com role `super_admin` ou `workspace_admin`, e só mostra alertas que:
  1) estão `is_active = true`
  2) não foram “dismissed” pelo usuário (`dismissed_by` não contém seu user_id)
  3) NÃO expiraram pelo “UI lifetime” (30s por padrão; 5 min para alertas `m365_*`), baseado em `created_at`
  4) passam pela RLS de `system_alerts` (inclui `target_role`)

Diagnóstico mais provável (causa raiz)
1) Alertas M365 estão sendo criados com `target_role = 'super_admin'`
- No edge function `supabase/functions/validate-m365-permissions/index.ts`, ao criar um alerta M365 novo, ele faz:
  - `target_role: 'super_admin'`
- A policy de SELECT da tabela `system_alerts` exige:
  - `target_role IS NULL OR has_role(auth.uid(), target_role)`
- Resultado prático:
  - Um usuário `workspace_admin` não consegue nem “ver” esses alertas (o REST retorna 200, mas a lista vem vazia ou sem o alerta específico por causa da RLS).
  - Isso explica perfeitamente o sintoma “não aparece nem após refresh” no fluxo M365 (exatamente a rota que você está: `/scope-m365/tenant-connection`).

2) Para alertas não-M365 (ex.: `firewall_analysis_completed`)
- Eles expiram no banner após 30s (por decisão de produto). Então, se você atualizar a página depois de alguns minutos, é esperado não aparecer.
- Isso não é bug; é efeito colateral desejado do “UI lifetime” de 30s.

Objetivo da correção agora
- Garantir que alertas M365 sejam visíveis para `workspace_admin` também (ou para ambos: `super_admin` + `workspace_admin`), já que são alertas operacionais e você explicitou que “Problemas M365” devem ter tempo maior (5 min).

Estratégia de implementação
A) Ajustar a criação/atualização de alertas M365 (backend – edge function)
1) Alterar `createOrUpdateAlert` (em `validate-m365-permissions/index.ts`) para aceitar `target_role` como parâmetro (ou definir uma regra padrão).
2) Para alertas M365, mudar `target_role` de `'super_admin'` para uma das opções abaixo:
   - Opção recomendada: `target_role: null` (aparece para qualquer usuário que a RLS permita; hoje o banner no UI ainda restringe para admin roles, então não “vaza” para usuários comuns na UI).
   - Opção alternativa: `target_role: 'workspace_admin'` e, se necessário, criar também um alerta separado para `super_admin` (não recomendo duplicar).
3) Garantir que quando o alerta for “update” (caso já exista), o `target_role` também seja ajustado (não só no insert), para corrigir alertas já existentes do mesmo tipo.

B) Melhorar observabilidade (frontend – banner) para confirmar assinatura e dados retornando
Mesmo que o problema principal seja RLS/target_role, vale deixar o banner um pouco mais “debugável”:
1) Logar status do Realtime subscribe (SUBSCRIBED / TIMED_OUT / CLOSED).
2) Logar quando o fetch retorna 0 alertas e por quê (ex.: role não permitida, expirado por lifetime, etc.) — com logs mais discretos (console.debug) para não poluir.

C) Plano de validação (passo a passo)
1) Cenário M365 (o que você está testando agora):
   - Disparar a validação/permissões M365 que gera `m365_connection_failure` ou `m365_permission_failure`.
   - Confirmar que o alerta aparece para um usuário `workspace_admin` sem precisar trocar de rota.
   - Confirmar que permanece por até 5 minutos (lifetime M365) ou até o usuário clicar em “Ver Configurações” / “X”.
2) Confirmar no banco (apenas leitura) que o alerta foi criado/atualizado com `target_role = null` (ou `workspace_admin`), e `created_at` recente.
3) Cenário não-M365:
   - Confirmar que alertas de conclusão de tarefa (não M365) continuam expirando em 30s conforme combinado.

Riscos / considerações
- Se vocês realmente quiserem que somente super_admin veja alguns alertas M365, precisamos separar “alertas técnicos” (somente super_admin) vs “alertas operacionais” (workspace_admin também). Hoje está tudo caindo em super_admin, e isso está escondendo sinal importante do time operacional.
- Se o alert estiver sendo criado mas não aparece, 99% das vezes é por (a) RLS/target_role ou (b) expiração pelo lifetime; esse ajuste endereça o (a).

Entregáveis (mudanças esperadas)
- Atualização de `supabase/functions/validate-m365-permissions/index.ts` para definir `target_role` compatível com `workspace_admin` (recomendado: null).
- Pequena melhoria de logs no `SystemAlertBanner.tsx` (opcional, mas recomendada para garantir que o realtime está saudável).

Critério de aceite
- Um usuário `workspace_admin` consegue ver alertas `m365_*` no banner, sem refresh, enquanto o alerta estiver dentro do lifetime (5 min) e `is_active=true`.
- Atualizar a página dentro do lifetime não “perde” o alerta.
- Após o lifetime, o alerta não aparece mais (como definido).

Sequência de execução (ordem)
1) Ajustar edge function `validate-m365-permissions` (target_role).
2) Validar via execução do fluxo M365.
3) Se necessário, adicionar/ajustar logs do banner para confirmar realtime + fetch.

