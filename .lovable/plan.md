

## Correção: Categorização de Mailboxes Inativas

### Problema

O backend usa lógica **cumulativa**: todos os inativos >=90d também aparecem nas listas de 60d e 30d. As três listas se sobrepõem em vez de serem faixas exclusivas.

O correto seria:
- **30d**: última atividade entre 30 e 60 dias atrás
- **60d**: última atividade entre 60 e 90 dias atrás
- **90d**: última atividade há mais de 90 dias (ou nunca)

### Correção

**Arquivo: `supabase/functions/exchange-dashboard/index.ts`**

Alterar a lógica de categorização nos dois branches (CSV e JSON) para usar faixas exclusivas:

```typescript
if (row['Last Activity Date']) {
  const lastActivity = new Date(row['Last Activity Date']);
  if (lastActivity < ninetyDaysAgo) {
    notLoggedIn90d++;
    inactiveUsers90.push({ name: upn, lastActivity: lastStr });
  } else if (lastActivity < sixtyDaysAgo) {
    notLoggedIn60d++;
    inactiveUsers60.push({ name: upn, lastActivity: lastStr });
  } else if (lastActivity < thirtyDaysAgo) {
    notLoggedIn30d++;
    inactiveUsers30.push({ name: upn, lastActivity: lastStr });
  }
} else {
  // "Nunca" vai para 90d
  notLoggedIn90d++;
  inactiveUsers90.push({ name: upn, lastActivity: 'Nunca' });
}
```

Mesma lógica no branch JSON (upnJ).

**Arquivo: `src/components/m365/exchange/ExchangeAnalyzerCategoryGrid.tsx`**

Atualizar os badges para somar as três faixas no total do card (se necessário para o valor principal), mantendo os badges individuais com os contadores exclusivos.

Redeploy da Edge Function após a correção.

