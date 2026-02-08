
# Plano: Adicionar SharePoint Sites.FullControl.All Automaticamente

## Contexto

Mesma lógica usada para Exchange.ManageAsApp - adicionar automaticamente a permissão do SharePoint ao App Registration antes do Admin Consent.

## IDs Identificados

| Serviço | Resource App ID | Permission ID | Nome |
|---------|-----------------|---------------|------|
| SharePoint Online | `00000003-0000-0ff1-ce00-000000000000` | `678536fe-1083-478a-9c59-b99265e6b0d3` | Sites.FullControl.All |
| Exchange Online | `00000002-0000-0ff1-ce00-000000000000` | `dc50a0fb-09a3-484d-be87-e023b12c6440` | Exchange.ManageAsApp |

## Alterações

### 1. Atualizar Edge Function `ensure-exchange-permission`

**Arquivo**: `supabase/functions/ensure-exchange-permission/index.ts`

Renomear conceitualmente para garantir **ambas** as permissões (Exchange + SharePoint) ou adicionar a lógica do SharePoint na mesma função.

**Mudanças no código:**

```typescript
// IDs existentes
const EXCHANGE_RESOURCE_ID = "00000002-0000-0ff1-ce00-000000000000";
const EXCHANGE_MANAGE_AS_APP_ID = "dc50a0fb-09a3-484d-be87-e023b12c6440";

// NOVOS IDs para SharePoint
const SHAREPOINT_RESOURCE_ID = "00000003-0000-0ff1-ce00-000000000000";
const SHAREPOINT_SITES_FULLCONTROL_ID = "678536fe-1083-478a-9c59-b99265e6b0d3";

// Lógica unificada para garantir ambas permissões
const permissionsToEnsure = [
  {
    resourceAppId: EXCHANGE_RESOURCE_ID,
    permissionId: EXCHANGE_MANAGE_AS_APP_ID,
    name: "Exchange.ManageAsApp",
  },
  {
    resourceAppId: SHAREPOINT_RESOURCE_ID,
    permissionId: SHAREPOINT_SITES_FULLCONTROL_ID,
    name: "Sites.FullControl.All",
  },
];
```

A função irá:
1. Buscar App Registration atual
2. Para cada permissão na lista:
   - Verificar se já existe no `requiredResourceAccess`
   - Se não existir, adicionar
3. Se houve alguma adição, fazer PATCH no App Registration
4. Retornar lista de permissões adicionadas

### 2. Resultado Esperado

Ao clicar em "Conectar Tenant" ou "Reconsentir":
1. Sistema adiciona `Exchange.ManageAsApp` + `Sites.FullControl.All` ao App Registration
2. Admin Consent URL abre
3. Admin consente todas as permissões
4. CBA para Exchange e acesso SharePoint funcionam

## Código Atualizado da Edge Function

```typescript
// Constantes
const EXCHANGE_RESOURCE_ID = "00000002-0000-0ff1-ce00-000000000000";
const EXCHANGE_MANAGE_AS_APP_ID = "dc50a0fb-09a3-484d-be87-e023b12c6440";
const SHAREPOINT_RESOURCE_ID = "00000003-0000-0ff1-ce00-000000000000";
const SHAREPOINT_SITES_FULLCONTROL_ID = "678536fe-1083-478a-9c59-b99265e6b0d3";

const REQUIRED_PERMISSIONS = [
  { resourceAppId: EXCHANGE_RESOURCE_ID, permissionId: EXCHANGE_MANAGE_AS_APP_ID, name: "Exchange.ManageAsApp" },
  { resourceAppId: SHAREPOINT_RESOURCE_ID, permissionId: SHAREPOINT_SITES_FULLCONTROL_ID, name: "Sites.FullControl.All" },
];

// Na lógica principal:
let addedPermissions: string[] = [];

for (const perm of REQUIRED_PERMISSIONS) {
  let resource = currentPermissions.find((r: any) => r.resourceAppId === perm.resourceAppId);
  
  if (!resource) {
    // Criar novo resource
    resource = { resourceAppId: perm.resourceAppId, resourceAccess: [] };
    currentPermissions.push(resource);
  }
  
  const hasPermission = resource.resourceAccess?.some((p: any) => p.id === perm.permissionId);
  
  if (!hasPermission) {
    resource.resourceAccess.push({ id: perm.permissionId, type: "Role" });
    addedPermissions.push(perm.name);
  }
}

if (addedPermissions.length > 0) {
  // PATCH app registration
  await fetch(appUrl, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requiredResourceAccess: currentPermissions }),
  });
}

return { success: true, added: addedPermissions.length > 0, permissions: addedPermissions };
```

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/functions/ensure-exchange-permission/index.ts` | Adicionar constantes do SharePoint e lógica unificada para garantir múltiplas permissões |

## Impacto

- **Conexão de novos tenants**: Automaticamente terá Exchange + SharePoint configurados
- **Reconsentir**: Também garantirá ambas as permissões
- **Tenants existentes**: Ao reconsentir, receberão a permissão do SharePoint

## Validação

Após implementação:
1. Clicar em "Reconsentir" no tenant
2. Verificar no Azure se `Sites.FullControl.All` aparece no App Registration
3. Testar coletas do SharePoint Online
