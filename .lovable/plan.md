

## Plano: Redeployar Edge Function + Melhorar Logging

### Diagnóstico
A edge function `collaboration-dashboard` **não está deployada** com o código atual (zero logs encontrados). O código já contém a lógica correta com `graphGetText` e `parseCsvReport` para extrair storage do CSV. Basta deployar e adicionar logs mais detalhados para diagnóstico.

**Sem fallback por drives individuais**, conforme solicitado.

### Alterações

**`supabase/functions/collaboration-dashboard/index.ts`** — Melhorar logging:
- Logar se `siteUsageText` retornou null (indicando falha de permissão ou API)
- Logar os headers do CSV para validar nomes das colunas
- Logar quantidade de linhas parseadas e primeiros bytes encontrados

```ts
// Após a chamada graphGetText:
if (siteUsageText) {
  console.log(`SharePoint report CSV length: ${siteUsageText.length} chars`);
  const rows = parseCsvReport(siteUsageText);
  console.log(`SharePoint report parsed: ${rows.length} rows`);
  if (rows.length > 0) {
    console.log(`SharePoint CSV headers: ${Object.keys(rows[0]).join(', ')}`);
  }
  // ... existing aggregation logic
} else {
  console.warn('SharePoint site usage report returned null - check Reports.Read.All permission');
}
```

### Deploy
Redeployar a edge function `collaboration-dashboard`. Após deploy, o usuário clica "Atualizar" no dashboard e os logs mostrarão exatamente onde está o problema (permissão, CSV vazio, ou nomes de colunas diferentes).

