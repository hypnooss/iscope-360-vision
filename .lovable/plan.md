

## Filtrar Guests e Shared Mailboxes do Insight "Usuários sem MFA Configurado"

### Diagnóstico

Você identificou corretamente o problema. O insight "Usuários sem MFA Configurado" no M365 Analyzer (20 usuários) usa dados brutos do `credentialRegistration` **sem filtrar guests nem shared mailboxes**. Enquanto isso, o dashboard do Entra ID já filtra guests na query Graph API (`userType eq 'member'`).

A API `userRegistrationDetails` retorna um campo `userType` por registro (`member` ou `guest`), que já está disponível nos dados — só não está sendo usado no filtro.

### Solução

Aplicar a mesma lógica de exclusão no `m365-analyzer`, filtrando:
1. **Guests** — via campo `userType !== 'member'` presente no `credentialRegistration`
2. **Shared Mailboxes** — cruzando UPNs/DisplayNames com `exoSharedMailboxes` (já coletado)

| Arquivo | Alteração |
|---|---|
| `supabase/functions/m365-analyzer/index.ts` | Na função `analyzeIdentityAccess`, filtrar `credentialRegistration` para excluir guests (`userType !== 'member'`) e shared mailboxes antes de calcular `noMfa`. Passar `exoSharedMailboxes` como parâmetro adicional da função. |

### Código (linha ~1712)

```typescript
// Filter out guests and shared mailboxes
const memberUsers = credentialRegistration.filter((u: any) => {
  if (u.userType && u.userType.toLowerCase() !== 'member') return false;
  const upn = (u.userPrincipalName || '').toLowerCase();
  const name = (u.userDisplayName || '').toLowerCase().trim();
  if (sharedMailboxUpns.has(upn) || sharedMailboxNames.has(name)) return false;
  return true;
});

const noMfa = memberUsers.filter((u: any) =>
  u.isMfaRegistered === false || u.isMfaCapable === false
);
```

O Set de shared mailboxes será construído a partir do `exoSharedMailboxes` já disponível no `allMetrics`, passado como parâmetro para `analyzeIdentityAccess`.

### Impacto

- O insight passará de 20 para ~5-8 usuários reais sem MFA (excluindo guests e shared mailboxes)
- A contagem de `affectedUsers` e a `severity` serão recalculadas corretamente
- Também atualizar o insight `all_users_mfa` (linha 1791) para usar a mesma base filtrada

