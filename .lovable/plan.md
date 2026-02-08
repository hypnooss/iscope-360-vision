
# Plano: Mapear Permissões Exchange/SharePoint para Nomes de Roles

## Contexto

As permissões `Exchange.ManageAsApp` e `Sites.FullControl.All` que adicionamos automaticamente ao App Registration precisam ser validadas e exibidas na interface. O usuário quer que sejam exibidas com os nomes:

- `Exchange.ManageAsApp` → **Exchange Administrator**
- `Sites.FullControl.All` → **SharePoint Administrator**

## Arquitetura Atual

O sistema **já exibe** "Exchange Administrator" e "SharePoint Administrator" na seção "Roles do Diretório (RBAC)" do `TenantStatusCard`, mas valida verificando se a **role do Azure AD** foi atribuída ao Service Principal.

## Nova Lógica

Substituir a validação de Directory Roles pela validação das **permissões de aplicativo** (que são concedidas via Admin Consent):

| Permissão Real (Azure) | Nome Exibido (UI) | Tipo |
|------------------------|-------------------|------|
| `Exchange.ManageAsApp` | Exchange Administrator | Application Permission |
| `Sites.FullControl.All` | SharePoint Administrator | Application Permission |

## Alterações

### 1. Edge Function `validate-m365-connection/index.ts`

**Adicionar teste das permissões Exchange/SharePoint:**

```typescript
// Constantes para os Resource IDs
const EXCHANGE_RESOURCE_ID = "00000002-0000-0ff1-ce00-000000000000";
const SHAREPOINT_RESOURCE_ID = "00000003-0000-0ff1-ce00-000000000000";
```

**Nova função para verificar permissões concedidas:**

```typescript
async function testAppRoleAssignment(
  accessToken: string, 
  appId: string, 
  resourceAppId: string, 
  appRoleId: string
): Promise<{ granted: boolean; error?: string }> {
  // 1. Buscar Service Principal do app
  // 2. Buscar Service Principal do recurso (Exchange/SharePoint)
  // 3. Verificar se existe appRoleAssignment entre eles
}
```

**Substituir os testes de Directory Roles:**

```typescript
// Ao invés de testar Exchange Administrator Role
const exchangeResult = await testAppRoleAssignment(
  accessToken, 
  app_id, 
  EXCHANGE_RESOURCE_ID, 
  "dc50a0fb-09a3-484d-be87-e023b12c6440" // Exchange.ManageAsApp
);
permissionResults.push({
  name: 'Exchange Administrator', // Nome amigável
  granted: exchangeResult.granted,
  required: false,
});

// Ao invés de testar SharePoint Administrator Role
const sharepointResult = await testAppRoleAssignment(
  accessToken, 
  app_id, 
  SHAREPOINT_RESOURCE_ID, 
  "678536fe-1083-478a-9c59-b99265e6b0d3" // Sites.FullControl.All
);
permissionResults.push({
  name: 'SharePoint Administrator', // Nome amigável
  granted: sharepointResult.granted,
  required: false,
});
```

### 2. TenantStatusCard.tsx (Sem Alterações)

A interface já está configurada corretamente:
- Exibe "Exchange Administrator" na seção "Roles do Diretório"
- Exibe "SharePoint Administrator" na seção "Roles do Diretório"

Os nomes já estão certos, só precisamos ajustar a validação backend.

### 3. Atualizar `validate-m365-permissions/index.ts` (Opcional)

Se esta função também for usada, aplicar a mesma lógica.

## Fluxo de Verificação (appRoleAssignments)

```text
1. GET /servicePrincipals?$filter=appId eq '{app_id}'
   → Obtém o Service Principal do nosso app

2. GET /servicePrincipals/{sp_id}/appRoleAssignments
   → Lista todas as atribuições de roles do app

3. Verificar se existe uma atribuição onde:
   - resourceAppId = Exchange/SharePoint Resource ID
   - appRoleId = Exchange.ManageAsApp / Sites.FullControl.All
```

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/functions/validate-m365-connection/index.ts` | Substituir validação de Directory Roles por validação de App Role Assignments |

## Benefícios

1. **Precisão**: Valida exatamente o que foi concedido via Admin Consent
2. **Consistência**: A edge function `ensure-exchange-permission` adiciona as permissões, e agora validamos essas mesmas permissões
3. **Simplicidade**: Não requer atribuição manual de Directory Roles
