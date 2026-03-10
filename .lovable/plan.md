

## Problema

A Edge Function `exchange-dashboard` filtra mailboxes Shared/Room/Equipment das inativas usando comparação exata:

```js
['shared', 'room', 'equipment'].includes(recipientType)
```

Mas a Graph API retorna valores como `"SharedMailbox"`, `"RoomMailbox"`, `"EquipmentMailbox"` (ou no CSV: `"Shared"`, `"SharedMailbox"`, etc.). A comparação exata nunca corresponde, então shared mailboxes acabam aparecendo na lista de inativas.

## Correção

### `supabase/functions/exchange-dashboard/index.ts`

Trocar a comparação exata por `.includes()` em ambos os caminhos (CSV e JSON):

**Caminho CSV (linha ~188):**
```js
// De:
const isNonUserMailbox = ['shared', 'room', 'equipment'].includes(recipientType);

// Para:
const isNonUserMailbox = recipientType.includes('shared') || recipientType.includes('room') || recipientType.includes('equipment');
```

**Caminho JSON (linha ~230):**
```js
// Mesma correção
const isNonUserMailboxJ = recipientTypeJ.includes('shared') || recipientTypeJ.includes('room') || recipientTypeJ.includes('equipment');
```

Isso garante que `"sharedmailbox"`, `"shared"`, `"SharedMailbox"` — qualquer variação — seja corretamente filtrada.

Mudança mínima, apenas 2 linhas na Edge Function. Após o deploy, basta re-executar a coleta para atualizar o cache.

