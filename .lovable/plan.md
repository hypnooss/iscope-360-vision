

## Remover Shared Mailboxes da Cobertura MFA (sempre)

### Problema
Shared mailboxes aparecem na lista de "MFA Desativado" na janela lateral de Cobertura MFA. O toggle "Excluir shared" é um paliativo no frontend, mas o correto é nunca incluí-las nos dados de MFA.

### Solução

Filtrar shared mailboxes **no backend** (`entra-id-dashboard/index.ts`) antes de calcular contagens e montar `userDetails`. Remover o toggle e badge "Shared" do frontend já que não serão mais necessários.

#### 1. Backend: `supabase/functions/entra-id-dashboard/index.ts`

Mover o bloco de fetch de shared mailboxes (linhas 336-362) para **antes** do cálculo de MFA (linha 209). Depois, filtrar `mfaUsers` para excluir shared mailboxes antes de calcular `mfaEnabled`, `mfaDisabled`, `mfaMethodCounts` e `userDetails`:

```typescript
// After building sharedMailboxUpns and sharedMailboxNames Sets...

const mfaUsersRaw = mfaRegistration || [];
const mfaUsers = mfaUsersRaw.filter((u: any) => {
  const upn = (u.userPrincipalName || '').toLowerCase();
  const name = (u.userDisplayName || '').toLowerCase().trim();
  return !sharedMailboxUpns.has(upn) && !sharedMailboxNames.has(name);
});
```

Remover `isSharedMailbox` do mapeamento de `userDetails` (não é mais necessário).

#### 2. Frontend: `src/components/m365/entra-id/EntraIdCategorySheet.tsx`

- Remover estado `excludeShared` e o bloco do toggle/banner de shared mailboxes (linhas 99, 168-169, 179-189)
- Usar `allUserDetails` diretamente (sem filtro de shared)
- Remover coluna "Tipo" do export Excel

#### 3. Frontend: `src/components/m365/entra-id/MfaUserList.tsx`

- Remover `isSharedMailbox` da interface e o badge "Shared" do render

#### 4. Frontend: `src/components/m365/entra-id/EntraIdAnalyzerCategoryGrid.tsx`

- Nenhuma alteração necessária (já usa `mfa.enabled`/`mfa.disabled` do backend)

#### 5. Hook: `src/hooks/useEntraIdDashboard.ts`

- Remover `isSharedMailbox` do tipo de `userDetails` em `EntraIdDashboardData`

### Resultado

As contagens de MFA (total, enabled, disabled) e todas as listas passarão a refletir apenas usuários membros reais, sem shared mailboxes. O card principal, a janela lateral e os insights ficarão consistentes.

