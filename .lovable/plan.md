

## Filtrar Shared, Room e Equipment das Mailboxes Inativas

### Alteração

**Arquivo: `supabase/functions/exchange-dashboard/index.ts`**

Nos dois branches (CSV e JSON), adicionar uma verificação do tipo de mailbox antes da lógica de inatividade:

**Branch CSV (~linha 187):** Antes do bloco `if (row['Last Activity Date'])`, adicionar:
```typescript
const recipientType = (row['Recipient Type'] || '').toLowerCase();
const isNonUserMailbox = ['shared', 'room', 'equipment'].includes(recipientType);
```
Envolver o bloco de inatividade (linhas 187-203) com `if (!isNonUserMailbox) { ... }`.

**Branch JSON (~linha 225):** Mesma lógica usando `row.recipientType`.

A contagem de `totalMailboxes`, `overQuota` e `newLast30d` continuam incluindo todos os tipos. Apenas a categorização de **inatividade** ignora Shared/Room/Equipment.

Redeploy da Edge Function.

