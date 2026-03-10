

## Problema

O relatório `getMailboxUsageDetail` retorna mailboxes com `Is Deleted = True` (soft-deleted, retidas pela Microsoft). O código atual não filtra esse campo, então mailboxes na lixeira aparecem como inativas e inflam os contadores.

## Correção

### `supabase/functions/exchange-dashboard/index.ts`

Adicionar verificação do campo `Is Deleted` logo no início do loop de processamento, em ambos os caminhos (CSV e JSON):

**Caminho CSV (~linha 182):** Após obter o `upn`, verificar:
```ts
const isDeleted = (row['Is Deleted'] || '').toLowerCase() === 'true';
if (isDeleted) return; // skip deleted mailboxes entirely
```
Isso exclui mailboxes deletadas de **todos** os cálculos (inativas, quota, novas, total).

**Caminho JSON (~linha 227):** Mesma lógica:
```ts
if (row.isDeleted) return;
```

**Também excluir do `totalMailboxes`:** Mover a contagem de `totalMailboxes` para dentro do loop (incrementar apenas para não-deletadas), em vez de usar `rows.length`.

### Resumo

| Arquivo | Mudança |
|---------|---------|
| `exchange-dashboard/index.ts` | Filtrar rows com `Is Deleted = True` no CSV e `isDeleted` no JSON; ajustar contagem total |

Mudança mínima (~6 linhas). Requer nova coleta após deploy.

