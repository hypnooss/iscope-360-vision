
Objetivo (ajuste de parâmetros)
- Alertas do tipo **M365*** (TENANT HOME) devem ser exibidos **somente** para as roles:
  - `super_admin`
  - `super_suporte`
- Todos os **demais** alertas podem ser exibidos para **todos os usuários autenticados** (qualquer role).

Diagnóstico do estado atual (baseado no código)
- `SystemAlertBanner.tsx` hoje:
  - Só busca/assina alertas quando `role === 'super_admin' || role === 'workspace_admin'` (linhas 28–37 e 143).
  - Isso impede usuários comuns e `super_suporte` de verem o banner, mesmo que o banco permita via RLS.
- `system_alerts.target_role` no banco é **um único** role (não suporta múltiplas roles por linha).
- Para satisfazer “M365 apenas super_admin e super_suporte” de forma forte (via RLS), precisamos criar **duas linhas** de alerta M365 (uma para cada role), ou mudar schema. Como queremos ajuste pontual, vamos pela opção das duas linhas.

Estratégia (sem mexer em schema do banco)
1) Backend (edge function `validate-m365-permissions`):
   - Para alertas M365, criar/atualizar **dois alertas ativos** com o mesmo `alert_type`, mas com `target_role` diferente:
     - um com `target_role = 'super_admin'`
     - outro com `target_role = 'super_suporte'`
   - Para isso, ajustar a função helper `createOrUpdateAlert` para considerar “mesmo tipo” + “mesma role alvo” ao procurar/atualizar um alerta existente:
     - Hoje ela busca apenas por `alert_type` e `is_active=true`. Isso impediria 2 alertas do mesmo tipo coexistirem.
     - Vamos mudar o filtro para também comparar `target_role` (incluindo o caso `null`).
   - Para alertas não-M365 (no futuro, se existirem em outros edge functions):
     - Manter `target_role = null` (visível a qualquer role, sujeito ao restante da RLS e ao banner).

2) Frontend (banner `SystemAlertBanner.tsx`):
   - Remover o “gate” que limita o banner somente a `super_admin/workspace_admin`.
   - Novo comportamento:
     - Se houver `user` autenticado: buscar alertas.
     - Assinar realtime quando houver `user` autenticado.
     - Renderizar banner para qualquer role, desde que existam alertas visíveis.
   - Manter o “UI lifetime” já definido:
     - Default 30s
     - `m365_*` 5 min (já está no `alertLifetime.ts`)
   - Manter o dismiss e auto-hide já implementados.
   - (Defesa extra) Filtrar `m365_*` no frontend caso `role` não seja `super_admin` ou `super_suporte`.
     - Na prática, com `target_role` preenchido, a RLS já bloqueia, mas esse filtro evita qualquer regressão caso no futuro alguém gere M365 com `target_role=null`.

Detalhes de implementação (passo a passo)

A) Ajustar edge function `supabase/functions/validate-m365-permissions/index.ts`
1. Alterar `createOrUpdateAlert`:
   - Na query de `existingAlert`, adicionar condição por `target_role`:
     - Se `options.targetRole` for `null`/`undefined`: procurar `target_role IS NULL`
     - Se for `'super_admin'`/`'super_suporte'`: procurar `.eq('target_role', options.targetRole)`
   - No update e insert, manter `target_role: options.targetRole ?? null` (já existe no diff).
2. Onde hoje chamamos `createOrUpdateAlert` para M365 (`m365_connection_failure`, `m365_permission_failure`):
   - Trocar de:
     - `targetRole: null`
   - Para:
     - chamar 2 vezes:
       - `targetRole: 'super_admin'`
       - `targetRole: 'super_suporte'`
3. Garantir que `dismissed_by` seja resetado em update (já está) para reaparecer quando o alerta “recai”.

B) Ajustar `src/components/alerts/SystemAlertBanner.tsx`
1. Buscar alertas para qualquer usuário autenticado:
   - `useEffect` de fetch: trocar condição baseada em role por condição baseada em `user?.id` (ou `session`).
2. Realtime subscription para qualquer usuário autenticado:
   - Remover o early-return que bloqueia se role não for admin.
3. Renderização:
   - Remover o `if (!['super_admin','workspace_admin'].includes(role...) || visibleAlerts.length === 0) return null;`
   - Substituir por:
     - `if (!user?.id || visibleAlerts.length === 0) return null;`
4. Filtragem adicional para M365 (defesa):
   - Antes de aplicar “lifetime”, filtrar:
     - se `alert.alert_type.startsWith('m365_')` e `role` não está em `['super_admin','super_suporte']`, remover.
   - Nota: Se o backend estiver correto (2 alertas com target_role), isso quase nunca será necessário, mas garante que “M365 não vaza” mesmo se no futuro target_role for setado incorretamente.

Testes / Validação (checklist prático)
1) Como `workspace_admin`:
   - Gerar um alerta M365 (ex.: tenant_id inválido / sem admin consent).
   - Confirmar que **não aparece** no banner.
2) Como `super_suporte`:
   - Gerar o mesmo erro M365.
   - Confirmar que aparece e fica até 5 minutos (ou até dismiss/ação).
3) Como `super_admin`:
   - Confirmar o mesmo.
4) Como `user` (role padrão):
   - Criar/ver um alerta não-M365 (se existir algum fluxo que crie alertas gerais) e confirmar que aparece por 30s.
5) Confirmar que refresh dentro do lifetime ainda mostra o alerta (desde que não tenha sido dismissado).

Riscos / Observações
- Duplicação intencional de alertas M365:
  - Haverá 2 registros no `system_alerts` para o mesmo `alert_type`, um por role. Isso é esperado.
  - O banner mostra apenas 1 “primaryAlert” por vez e exibirá “+N outros” se ambos estiverem visíveis para um usuário (não ocorrerá, pois um usuário não deve ter simultaneamente super_admin e super_suporte; e mesmo se tiver, ele veria +1).
- Se algum outro edge function criar alertas “globais”, ele pode continuar usando `target_role = null` para ser visível a todos, sem mudanças.

Arquivos que serão modificados
- `supabase/functions/validate-m365-permissions/index.ts`
- `src/components/alerts/SystemAlertBanner.tsx`

Resultado esperado
- M365*: somente `super_admin` e `super_suporte` veem (forçado por RLS via `target_role`).
- Outros alertas: qualquer usuário autenticado pode ver (banner deixa de restringir por role).
