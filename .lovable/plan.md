
Contexto e causa raiz
- Você executou uma tarefa de “Domínios externos” (external_domain) e, ao concluir, o banner não apareceu.
- Ao inspecionar o backend, encontramos que o banner só aparece quando existe um registro em `system_alerts` para o evento.
- No edge function `supabase/functions/agent-task-result/index.ts`:
  - Para `task.target_type === 'firewall'`, o sistema cria um alerta `system_alerts` com `alert_type = 'firewall_analysis_completed'`.
  - Para `task.target_type === 'external_domain'`, o sistema salva histórico em `external_domain_analysis_history`, mas NÃO cria nenhum `system_alerts`.
- Resultado: mesmo com a UI do banner funcionando, não há “evento” para ele mostrar quando a análise de domínios externos finaliza.

Objetivo do ajuste (confirmado com você)
- Ao concluir uma análise de Domínios externos, exibir um banner de sucesso com botão “Ver Relatório”.
- Esse banner deve ser visível para “Todos autenticados” (ou seja, `target_role = null`), e o acesso é naturalmente limitado por RLS do restante do sistema (cliente/domínio), além do próprio usuário precisar estar logado.

Solução proposta (sem mudanças de schema)
A) Backend: criar alerta de conclusão para external_domain
1) Arquivo: `supabase/functions/agent-task-result/index.ts`
2) No bloco já existente que roda quando:
   - `task.target_type === 'external_domain'`
   - e `complianceResult && score !== null`
3) Ajustar a inserção do histórico em `external_domain_analysis_history` para retornar o ID do relatório criado:
   - trocar o insert atual por um insert com `.select('id').single()` (ou equivalente) para obter `report_id`.
4) Depois do histórico ser salvo com sucesso, inserir um registro em `system_alerts` (modelo semelhante ao firewall):
   - `alert_type`: `external_domain_analysis_completed`
   - `title`: algo como “Análise Concluída”
   - `message`: algo como `A análise do domínio "<nome do domínio>" foi concluída com score X%.`
   - `severity`: `success` (para usar o visual “verde/teal” existente)
   - `target_role`: `null` (visível para todos autenticados)
   - `is_active`: `true`
   - `expires_at`: manter um TTL longo no banco (ex.: 24h) para permitir que o alerta exista no backend, mas a UI ainda aplicará o “UI lifetime” (30s para não-M365)
   - `metadata`: incluir pelo menos:
     - `domain_id`: `task.target_id`
     - `report_id`: id retornado de `external_domain_analysis_history`
     - `score`: score calculado
     - opcional: `domain_name` se buscarmos no banco (ver item 5)
5) Complemento recomendado: buscar o “nome amigável” do domínio para melhorar a mensagem do banner:
   - antes de criar o alerta, fazer um `select` em `external_domains` por `id=task.target_id` e pegar `name` e/ou `domain`.
   - fallback: se não achar, usar “Domínio externo”.

B) Frontend: adicionar ação “Ver Relatório” para esse novo tipo de alerta
1) Arquivo: `src/components/alerts/SystemAlertBanner.tsx`
2) O banner já está assinado no Realtime e já carrega `metadata`.
3) Adicionar uma nova regra de ação, similar ao trecho existente para `firewall_analysis_completed`:
   - Quando `primaryAlert.alert_type === 'external_domain_analysis_completed'` e `metadata.domain_id` e `metadata.report_id` existirem:
     - Renderizar botão “Ver Relatório”
     - Ao clicar:
       - chamar `dismissAlert(alertId)` (como já acontece nos outros botões)
       - navegar para: `/scope-external-domain/domains/${domainId}/report/${reportId}`
4) Manter o restante do comportamento:
   - Lifetimes: não-M365 continua expirar visualmente em 30s (conforme você disse “pode expirar”)
   - M365 continua restrito a `super_admin` e `super_suporte` (já ajustado anteriormente)

Cenários de teste (end-to-end)
1) Como um usuário autenticado (role qualquer) com acesso ao client/domínio:
   - Executar uma análise de Domínios externos
   - Ao concluir:
     - banner aparece com severidade “success”
     - botão “Ver Relatório” abre exatamente a rota do relatório criado
2) Confirmar que:
   - Após atualizar a página logo após concluir (dentro de ~30s), o banner ainda aparece
   - Após >30s, o banner pode não aparecer (comportamento esperado do UI lifetime)
3) Confirmar que o relatório abre sem erro e que a página corresponde ao `report_id` inserido no histórico.

Observações / riscos
- Se o `agent-task-result` às vezes marca status `partial` ou termina sem `complianceResult`/`score`, o alerta só será criado quando houver score (igual ao comportamento atual do firewall). Se você quiser banner mesmo em “partial” ou “failed”, podemos adicionar alertas de warning/error em uma iteração futura.
- O banner depende do usuário estar logado e do RLS permitir o SELECT em `system_alerts`. Como `target_role` será `null`, qualquer usuário autenticado poderá ver, mas ele ainda pode “não aparecer” se o usuário já tiver dispensado (`dismissed_by`) ou se o UI lifetime já tiver expirado.

Arquivos que serão modificados
- `supabase/functions/agent-task-result/index.ts`
- `src/components/alerts/SystemAlertBanner.tsx`
