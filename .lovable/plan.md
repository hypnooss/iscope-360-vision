

## Problema: Storage SharePoint retorna 0.0 / 0.0 GB

O endpoint `getSharePointSiteUsageDetail` da Graph API v1.0 retorna **CSV** por padrão. A função `graphGet` sempre chama `res.json()`, que falha silenciosamente ao tentar parsear CSV, resultando em `null`. Por isso `storageUsedBytes` e `storageAllocatedBytes` ficam em 0.

### Correção

**Arquivo:** `supabase/functions/collaboration-dashboard/index.ts`

1. Criar uma função `graphGetText` que retorna a resposta como texto bruto (para endpoints de relatório que devolvem CSV):

```ts
async function graphGetText(accessToken: string, url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) { console.warn(`Graph GET text ${url} failed: ${res.status}`); return null; }
  return await res.text();
}
```

2. Alterar a chamada do relatório (linha ~205) para usar `graphGetText` em vez de `graphGet`, removendo o header `Accept: application/json`:

```ts
const siteUsageCsv = await graphGetText(
  accessToken,
  "https://graph.microsoft.com/v1.0/reports/getSharePointSiteUsageDetail(period='D30')"
).catch(() => null);
```

3. Ajustar a lógica de parsing: o resultado agora será sempre `string | null`, então a condição `typeof siteUsageCsv === 'string'` será verdadeira e o `parseCsvReport` fará o parse correto do CSV. Remover o branch `else if (siteUsageCsv?.value)` que tratava JSON (desnecessário com v1.0).

4. Adicionar log de debug para confirmar os bytes encontrados:
```ts
console.log(`SharePoint storage: used=${storageUsedBytes}, allocated=${storageAllocatedBytes}, rows=${rows.length}`);
```

### Deploy

Após a edição, fazer deploy da edge function `collaboration-dashboard` e o usuário deverá clicar em "Atualizar" no dashboard para recoleta.

