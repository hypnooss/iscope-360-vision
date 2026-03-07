

## Adicionar permissão `ServiceHealth.Read.All` ao pipeline de permissões M365

### Problema

A permissão `ServiceHealth.Read.All` não está registrada no sistema de gerenciamento de permissões. Os endpoints `/admin/serviceAnnouncement/healthOverviews` e `/admin/serviceAnnouncement/issues` retornam erro porque o App Registration no Azure não possui esta permissão no manifesto e ela nunca é validada por tenant.

### Alterações

**1. `supabase/functions/ensure-exchange-permission/index.ts`**

Adicionar à lista `REQUIRED_PERMISSIONS`:
```ts
{ resourceAppId: GRAPH_RESOURCE_ID, permissionId: "79c261e0-fe76-4144-aad5-bdc68fbe4037", name: "ServiceHealth.Read.All" }
```

Isso garante que ao revalidar permissões, o manifesto do App Registration será atualizado com este escopo.

**2. `supabase/functions/validate-m365-connection/index.ts`**

- Adicionar `'ServiceHealth.Read.All'` à lista `REQUIRED_PERMISSIONS` (linha ~42)
- Adicionar bloco de validação no `else if` chain (após `Reports.Read.All`, ~linha 628):

```ts
} else if (permission === 'ServiceHealth.Read.All') {
  const response = await fetch('https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/healthOverviews?$top=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  granted = response.ok;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
}
```

### Fluxo esperado após a alteração

1. Admin acessa **Configurações** e executa a revalidação de permissões
2. `ensure-exchange-permission` detecta `ServiceHealth.Read.All` ausente no manifesto e faz PATCH
3. Admin concede Admin Consent no popup do Azure
4. `validate-m365-connection` verifica a nova permissão e persiste status `granted`
5. A página **Saúde do 365** passa a retornar dados

### Arquivos

1. `supabase/functions/ensure-exchange-permission/index.ts` — adicionar permissão ao manifesto
2. `supabase/functions/validate-m365-connection/index.ts` — adicionar validação da permissão

