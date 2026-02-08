

# Plano: Sincronizar Validação de Permissões UI ↔ Backend

## Problema Identificado

A UI (`TenantStatusCard`) exibe **16 permissões**, mas o backend (`validate-m365-connection`) só valida **9 permissões**. As permissões que aparecem em âmbar (pending) não estão sendo validadas.

### Permissões Faltando no Backend

| Permissão | Tipo | Endpoint de Teste |
|-----------|------|-------------------|
| Organization.Read.All | Graph API | `/organization` |
| Policy.Read.All | Graph API | `/policies/conditionalAccessPolicies` |
| Sites.Read.All | Graph API | `/sites?search=*` |
| Application.ReadWrite.All | Graph API | `/applications/{app_object_id}` (PATCH) |
| User.Read | Graph API | N/A - é delegated permission |
| Reports.Read.All | Graph API | `/reports/authenticationMethods/userRegistrationDetails` |
| SharePoint Administrator | Directory Role | RoleDefinitionId: `f28a1f50-f6e7-4571-818b-6a12f2af6b6c` |

## Alterações

### Arquivo: supabase/functions/validate-m365-connection/index.ts

#### 1. Adicionar novas permissões na lista (linha 23-33)

**Antes:**
```typescript
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'RoleManagement.ReadWrite.Directory',
  'MailboxSettings.Read',
  'Mail.Read',
];
```

**Depois:**
```typescript
const REQUIRED_PERMISSIONS = [
  // Entra ID
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'Organization.Read.All',
  'Policy.Read.All',
  // Exchange Online
  'RoleManagement.ReadWrite.Directory',
  'MailboxSettings.Read',
  'Mail.Read',
  // SharePoint
  'Sites.Read.All',
  // Outros
  'Reports.Read.All',
];

// Certificate Permissions (only if app_object_id provided)
const CERTIFICATE_PERMISSIONS = [
  'Application.ReadWrite.All',
];
```

#### 2. Adicionar testes para novas permissões (após linha 468)

```typescript
} else if (permission === 'Organization.Read.All') {
  const response = await fetch('https://graph.microsoft.com/v1.0/organization?$select=id', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  granted = response.ok;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);

} else if (permission === 'Policy.Read.All') {
  const response = await fetch('https://graph.microsoft.com/v1.0/policies/conditionalAccessPolicies?$top=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  // 403 = no permission, 400/200 = permission exists
  granted = response.ok || response.status === 400;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);

} else if (permission === 'Sites.Read.All') {
  const response = await fetch('https://graph.microsoft.com/v1.0/sites?search=*&$top=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  granted = response.ok;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);

} else if (permission === 'Reports.Read.All') {
  const response = await fetch('https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  // May return 403 if no license, 400/200 if permission exists
  granted = response.ok || response.status === 400;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
}
```

#### 3. Adicionar validação do Application.ReadWrite.All (após linha 488)

```typescript
// Test certificate upload permission if we have the app_object_id
// First, try to get app_object_id from m365_app_credentials
const { data: appCreds } = await supabase
  .from('m365_app_credentials')
  .select('app_object_id')
  .eq('tenant_record_id', tenant_record_id)
  .maybeSingle();

if (appCreds?.app_object_id) {
  console.log('Testing Application.ReadWrite.All with app_object_id:', appCreds.app_object_id);
  const appResponse = await fetch(
    `https://graph.microsoft.com/v1.0/applications/${appCreds.app_object_id}?$select=id,keyCredentials`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  const appWriteGranted = appResponse.ok;
  permissionResults.push({
    name: 'Application.ReadWrite.All',
    granted: appWriteGranted,
    required: false,
  });
  console.log(`Permission Application.ReadWrite.All: ${appResponse.status} - granted: ${appWriteGranted}`);
} else {
  console.log('Skipping Application.ReadWrite.All test (no app_object_id)');
  permissionResults.push({
    name: 'Application.ReadWrite.All',
    granted: false,
    required: false,
  });
}
```

#### 4. Adicionar validação do SharePoint Administrator Role (após linha 489)

```typescript
// SharePoint Administrator Role Template ID
const SHAREPOINT_ADMIN_ROLE_TEMPLATE_ID = 'f28a1f50-f6e7-4571-818b-6a12f2af6b6c';

// Test SharePoint Administrator Role assignment
console.log('Testing SharePoint Administrator Role assignment...');
const spAdminResult = await testDirectoryRole(accessToken, app_id, SHAREPOINT_ADMIN_ROLE_TEMPLATE_ID);
permissionResults.push({
  name: 'SharePoint Administrator',
  granted: spAdminResult.granted,
  required: false,
});
console.log(`SharePoint Administrator: ${spAdminResult.granted ? 'assigned' : 'not assigned'}`);
```

#### 5. Criar função genérica para testar Directory Roles (antes da linha 39)

```typescript
async function testDirectoryRole(
  accessToken: string, 
  appId: string, 
  roleTemplateId: string
): Promise<{granted: boolean, error?: string}> {
  try {
    // Get the Service Principal for the app
    const spResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${appId}'&$select=id`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!spResponse.ok) {
      return { granted: false, error: 'SP lookup failed' };
    }
    
    const spData = await spResponse.json();
    const spId = spData.value?.[0]?.id;
    
    if (!spId) {
      return { granted: false, error: 'SP not found' };
    }
    
    // Query role assignments for this role
    const roleResponse = await fetch(
      `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$filter=roleDefinitionId eq '${roleTemplateId}'`,
      { 
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'ConsistencyLevel': 'eventual'
        } 
      }
    );
    
    if (roleResponse.ok) {
      const roleData = await roleResponse.json();
      const hasRole = roleData.value?.some(
        (a: { principalId: string }) => a.principalId === spId
      );
      return { granted: hasRole };
    }
    
    // Fallback: fetch all assignments
    const allRolesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (allRolesResponse.ok) {
      const allRolesData = await allRolesResponse.json();
      const match = allRolesData.value?.find(
        (a: { principalId: string; roleDefinitionId: string }) => 
          a.principalId === spId && a.roleDefinitionId === roleTemplateId
      );
      return { granted: !!match };
    }
    
    return { granted: false, error: `HTTP ${roleResponse.status}` };
  } catch (error) {
    return { granted: false, error: String(error) };
  }
}
```

### Sobre User.Read

A permissão `User.Read` é uma **delegated permission** (não Application). Ela é usada durante o login interativo do usuário, não no fluxo de Client Credentials. Por isso:

- **Recomendação**: Remover `User.Read` da lista de permissões na UI, pois não faz sentido validá-la em um contexto de aplicativo.

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/validate-m365-connection/index.ts` | Adicionar validação para 6 permissões faltantes e 1 Directory Role |
| `src/components/m365/TenantStatusCard.tsx` | Remover `User.Read` da lista (opcional) |

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 9/16 validadas | 15/15 validadas (ou 16/16 se mantiver User.Read) |
| Permissões em âmbar sem motivo | Todas as permissões com status real |

## Observação sobre User.Read

`User.Read` é uma permissão **delegated** (delegada), não **application**. Ela só funciona em fluxos interativos (login de usuário), não em Client Credentials (aplicativo). 

Há duas opções:
1. **Remover da UI**: A permissão não se aplica ao contexto
2. **Manter como sempre granted**: Se foi dado admin consent, considerar como granted

Recomendo a opção 1 (remover), mas aguardo sua preferência.

