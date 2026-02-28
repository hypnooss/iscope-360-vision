
## Adicionar IdentityRiskyUser.Read.All ao manifest do App Registration

### Problema raiz

Os logs confirmam:
```
Permission IdentityRiskyUser.Read.All: 403
code: Forbidden
msg: You cannot perform the requested operation, required scopes are missing in the token.
```

A permissao `IdentityRiskyUser.Read.All` **nunca foi adicionada ao manifest do App Registration** no Azure. A edge function `ensure-exchange-permission` e responsavel por adicionar permissoes ao manifest via PATCH na Graph API, mas ela so inclui Exchange (`ManageAsApp`) e SharePoint (`Sites.FullControl.All`). Como a permissao nao esta no manifest, ela nao aparece no popup de admin consent (como voce viu no print) e o token nunca recebe esse scope.

### Solucao

**Arquivo: `supabase/functions/ensure-exchange-permission/index.ts`**

Adicionar `IdentityRiskyUser.Read.All` a lista `REQUIRED_PERMISSIONS`:

```typescript
// Microsoft Graph
const GRAPH_RESOURCE_ID = "00000003-0000-0000-c000-000000000000";
const IDENTITY_RISKY_USER_READ_ALL_ID = "dc5007c0-2d7d-4c42-879c-2dab87571379";

const REQUIRED_PERMISSIONS = [
  { resourceAppId: EXCHANGE_RESOURCE_ID, permissionId: EXCHANGE_MANAGE_AS_APP_ID, name: "Exchange.ManageAsApp" },
  { resourceAppId: SHAREPOINT_RESOURCE_ID, permissionId: SHAREPOINT_SITES_FULLCONTROL_ID, name: "Sites.FullControl.All" },
  { resourceAppId: GRAPH_RESOURCE_ID, permissionId: IDENTITY_RISKY_USER_READ_ALL_ID, name: "IdentityRiskyUser.Read.All" },
];
```

### Fluxo esperado apos a correcao

1. Ao conectar/reconectar o tenant, `ensure-exchange-permission` adiciona `IdentityRiskyUser.Read.All` ao manifest do app no Azure
2. O popup de admin consent agora lista "Read all risky user information"
3. Apos o admin consent, o token inclui o scope `IdentityRiskyUser.Read.All`
4. A validacao via `validate-m365-connection` retorna 200 (granted)
5. UI mostra 16/16 permissoes

### Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `ensure-exchange-permission/index.ts` | Adicionar `IdentityRiskyUser.Read.All` (Graph API) a lista de permissoes obrigatorias |

### Nota importante

Apos o deploy, sera necessario:
1. Clicar em "Revalidar Permissoes" no tenant da Movecta (isso dispara o `ensure-exchange-permission` que vai adicionar a permissao ao manifest)
2. Conceder admin consent novamente no popup (agora com a nova permissao listada)
3. Clicar em "Testar" para validar que passou para 16/16
