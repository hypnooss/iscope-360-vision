

## Correção: Drill-down de Auto-Reply Externo sem lista de mailboxes

### Causa raiz

A Edge Function `exchange-dashboard` já itera `mailboxSettings` de cada usuário para contar `autoReplyExternal`, mas **descarta a identidade** dos usuários — salva apenas o contador. O frontend (linha 448 do `ExchangeCategorySheet`) não tem lista de auto-reply e retorna `[]`.

### Correção em 2 partes

**1. Backend: `supabase/functions/exchange-dashboard/index.ts`**

Alterar a lógica de coleta (linhas 220-242) para, além de incrementar o contador, acumular um array `autoReplyUsers` com `{ name, status, externalAudience }` de cada mailbox com auto-reply externo ativo. Salvar esse array no resultado:

```typescript
// Antes: apenas autoReplyExternal++
// Depois: acumular detalhes
const autoReplyUsers: { name: string; status: string; externalAudience: string }[] = [];

// Dentro do loop de settingsPromises:
if (auto-reply detectado) {
  autoReplyExternal++;
  autoReplyUsers.push({
    name: settings.userPrincipalName || u.id,
    status: settings.automaticRepliesSetting.status,
    externalAudience: settings.automaticRepliesSetting.externalAudience,
  });
}
```

Necessário também buscar `userPrincipalName` na query de users (`$select=id,userPrincipalName`).

Incluir `autoReplyUsers` no objeto `mailboxes` do resultado.

**2. Frontend: `src/components/m365/exchange/ExchangeCategorySheet.tsx`**

Na linha 448, adicionar o caso `auto_reply` que lê `dashboardData?.mailboxes.autoReplyUsers || []`, mapeando para o formato esperado pelo `MailboxDetailList`.

**3. Frontend: Tipo do dashboard** (se existir interface tipada para `dashboardData.mailboxes`)

Adicionar `autoReplyUsers?: { name: string; status: string; externalAudience: string }[]` ao tipo.

