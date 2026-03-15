

## Correção: Shared Mailboxes não detectadas por diferença de UPN entre domínios

### Causa Raiz

O tenant Precisio usa múltiplos domínios (`@deployit.group`, `@precisio.global`, `@precisio.services`, `@precisio.io`, `@gyna.tech`). O Exchange retorna shared mailboxes com UPN de um domínio (ex: `backoffice@precisio.global`) enquanto o Entra ID MFA report usa outro domínio (ex: `backoffice@deployit.group`). O match por UPN exato falha em 14 dos 18 casos.

### Solução

Alterar o `entra-id-dashboard` edge function para usar **match por DisplayName (case-insensitive)** como fallback quando o UPN não corresponde:

1. Construir dois Sets: `sharedMailboxUpns` (match por UPN, como hoje) e `sharedMailboxNames` (match por DisplayName normalizado)
2. Na marcação de `isSharedMailbox`, verificar ambos: `sharedMailboxUpns.has(upn)` **OR** `sharedMailboxNames.has(displayName)`

### Arquivo Afetado

| Arquivo | Alteração |
|---|---|
| `supabase/functions/entra-id-dashboard/index.ts` | Adicionar `sharedMailboxNames` Set e usar como fallback no match |

### Código

```typescript
// Linhas 337-359: adicionar Set de nomes
let sharedMailboxUpns = new Set<string>();
let sharedMailboxNames = new Set<string>();
// ... dentro do forEach:
const name = m.DisplayName || m.displayName || '';
if (name) sharedMailboxNames.add(name.toLowerCase().trim());

// Linha 392: usar ambos no match
isSharedMailbox: sharedMailboxUpns.has(upn.toLowerCase()) 
  || sharedMailboxNames.has((u.userDisplayName || '').toLowerCase().trim()),
```

