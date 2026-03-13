

## Filtrar Guests e contas não-interativas do cálculo MFA

### Problema
A API `userRegistrationDetails` retorna **todos** os usuários do diretório, incluindo Guests e contas de serviço. Isso infla o "Total Analisados" e o "Sem MFA", já que essas contas tipicamente não usam MFA.

### Solução
Filtrar no endpoint da Graph API usando `$filter=userType eq 'member'` para excluir Guests. Isso resolve na origem, reduzindo dados transferidos e garantindo que o cálculo reflita apenas contas Member.

### Alterações

#### 1. Edge Function (`supabase/functions/entra-id-dashboard/index.ts`)
- Linha 160: Alterar a URL do `userRegistrationDetails` para incluir filtro:
  ```
  .../userRegistrationDetails?$filter=userType eq 'member'&$top=999
  ```
- Isso exclui automaticamente Guests de `mfaUsers`, afetando `mfa.total`, `mfa.enabled`, `mfa.disabled` e `mfa.methodBreakdown`.

#### 2. UI (`src/components/m365/entra-id/EntraIdCategorySheet.tsx`)
- Alterar o label "Total Analisados" para "Membros Analisados" para deixar claro que Guests estão excluídos.
- Remover o card "Sem MFA" da seção "Distribuição MFA por Método" (já aparece no Resumo acima como dado duplicado).
- Remover o segmento "Sem MFA" da `ProportionalBar` de métodos — essa barra deve mostrar apenas a distribuição entre os métodos registrados.
- Adicionar nota `text-xs text-muted-foreground`: _"Exclui contas Guest. Um usuário pode ter mais de um método."_

#### 3. Redeploy da Edge Function
Após alteração, redeployar e executar nova análise para gerar snapshot atualizado.

