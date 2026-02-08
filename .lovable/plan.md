
# Plano: Automatizar Atribuição da Role Exchange Administrator

## Análise do Problema

O erro "UnAuthorized" no PowerShell Exchange Online ocorre porque o Service Principal do App precisa ter a role **Exchange Administrator** atribuída no Azure AD do tenant cliente. Esta role não é concedida automaticamente pelo Admin Consent - requer atribuição manual ou via Graph API.

### Fluxo Atual (Problema)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOTÃO "PERMISSÕES" - Fluxo Atual                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Clique em "Permissões"                                                  │
│  2. Abre Admin Consent Window                                               │
│  3. Admin concede permissões Graph API (User.Read.All, etc.)               │
│  4. m365-oauth-callback valida permissões Graph                            │
│  5. Conexão estabelecida                                                    │
│                                                                             │
│  PROBLEMA: Exchange Administrator Role NÃO é concedida!                    │
│  PowerShell Connect-ExchangeOnline falha com "UnAuthorized"                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Requisito Técnico

Para conectar ao Exchange Online via PowerShell com CBA (Certificate-Based Authentication), o Service Principal precisa de uma das seguintes roles:
- **Exchange Administrator** (29232cdf-9323-42fd-ade2-1d097af3e4de)
- **Global Administrator** (não recomendado por ser privilegiada demais)

Esta atribuição é feita via:
```
POST /roleManagement/directory/roleAssignments
{
  "roleDefinitionId": "29232cdf-9323-42fd-ade2-1d097af3e4de",
  "principalId": "<service-principal-object-id>",
  "directoryScopeId": "/"
}
```

---

## Solução Proposta

Modificar o fluxo do `m365-oauth-callback` para, após o Admin Consent, automaticamente atribuir a role Exchange Administrator ao Service Principal do App no tenant cliente.

### Pré-requisito

A aplicação multi-tenant precisa ter a permissão **RoleManagement.ReadWrite.Directory** configurada no Azure. Se não tiver, o sistema tentará a atribuição e falhará graciosamente, indicando ao usuário que deve fazer manualmente.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/m365-oauth-callback/index.ts` | Adicionar lógica de atribuição de role após consentimento |
| `supabase/functions/validate-m365-permissions/index.ts` | Adicionar verificação de Exchange Admin Role |
| `src/components/m365/TenantStatusCard.tsx` | Exibir status da role Exchange Administrator |

---

## Mudanças Detalhadas

### 1. `m365-oauth-callback/index.ts` - Atribuir Role Automaticamente

Após o Admin Consent ser concedido com sucesso, adicionar:

```typescript
// Constants for Exchange Administrator role
const EXCHANGE_ADMIN_ROLE_TEMPLATE_ID = '29232cdf-9323-42fd-ade2-1d097af3e4de';

// Function to assign Exchange Administrator role to the App's Service Principal
async function assignExchangeAdminRole(
  accessToken: string, 
  appId: string, 
  tenantId: string
): Promise<{ success: boolean; error?: string; alreadyAssigned?: boolean }> {
  try {
    // 1. Get Service Principal by App ID
    const spResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${appId}'&$select=id,displayName`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!spResponse.ok) {
      return { success: false, error: 'Failed to find Service Principal' };
    }
    
    const spData = await spResponse.json();
    const servicePrincipalId = spData.value?.[0]?.id;
    
    if (!servicePrincipalId) {
      return { success: false, error: 'Service Principal not found in tenant' };
    }
    
    // 2. Check if role is already assigned
    const checkResponse = await fetch(
      `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$filter=principalId eq '${servicePrincipalId}' and roleDefinitionId eq '${EXCHANGE_ADMIN_ROLE_TEMPLATE_ID}'`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.value?.length > 0) {
        return { success: true, alreadyAssigned: true };
      }
    }
    
    // 3. Assign the Exchange Administrator role
    const assignResponse = await fetch(
      'https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          '@odata.type': '#microsoft.graph.unifiedRoleAssignment',
          roleDefinitionId: EXCHANGE_ADMIN_ROLE_TEMPLATE_ID,
          principalId: servicePrincipalId,
          directoryScopeId: '/',
        }),
      }
    );
    
    if (assignResponse.ok || assignResponse.status === 201) {
      return { success: true };
    }
    
    const errorBody = await assignResponse.json().catch(() => ({}));
    return { 
      success: false, 
      error: errorBody?.error?.message || `HTTP ${assignResponse.status}` 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

Após validar permissões Graph, chamar:

```typescript
// Attempt to assign Exchange Administrator role for PowerShell connectivity
console.log('Attempting to assign Exchange Administrator role...');
const roleResult = await assignExchangeAdminRole(accessToken, appId, tenant_id);
if (roleResult.success) {
  console.log(roleResult.alreadyAssigned 
    ? 'Exchange Administrator role already assigned' 
    : 'Exchange Administrator role assigned successfully');
} else {
  console.warn('Could not assign Exchange Administrator role:', roleResult.error);
  // Not a blocking error - PowerShell features may not work, but Graph API will
}
```

### 2. `validate-m365-permissions/index.ts` - Verificar Role

Adicionar teste para Exchange Administrator role na lista de permissões:

```typescript
// Check Exchange Administrator role assignment
const EXCHANGE_ADMIN_ROLE_ID = '29232cdf-9323-42fd-ade2-1d097af3e4de';

async function testExchangeAdminRole(accessToken: string, appId: string): Promise<boolean> {
  try {
    // Get Service Principal
    const spResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${appId}'&$select=id`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!spResponse.ok) return false;
    
    const spData = await spResponse.json();
    const spId = spData.value?.[0]?.id;
    if (!spId) return false;
    
    // Check role assignment
    const roleResponse = await fetch(
      `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$filter=principalId eq '${spId}' and roleDefinitionId eq '${EXCHANGE_ADMIN_ROLE_ID}'`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!roleResponse.ok) return false;
    
    const roleData = await roleResponse.json();
    return (roleData.value?.length || 0) > 0;
  } catch {
    return false;
  }
}
```

Adicionar na lista de permissões recomendadas:

```typescript
// Add to permissions list
results.push({ 
  name: 'Exchange Administrator Role', 
  granted: await testExchangeAdminRole(accessToken, appId), 
  type: 'recommended' 
});
```

### 3. `TenantStatusCard.tsx` - Mostrar Status da Role

Atualizar a exibição de permissões para destacar a Exchange Administrator Role:

```typescript
// Add icon for role-type permissions
const isRole = perm.permission_name.includes('Role');
// ... render with Shield icon for roles
```

---

## Fluxo Após Implementação

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  BOTÃO "PERMISSÕES" - Novo Fluxo                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Clique em "Permissões"                                                  │
│  2. Abre Admin Consent Window                                               │
│  3. Admin concede permissões Graph API                                      │
│  4. m365-oauth-callback:                                                    │
│     a) Valida permissões Graph API                                          │
│     b) NOVO: Tenta atribuir Exchange Administrator role                    │
│     c) Registra resultado (sucesso ou falha graceful)                      │
│  5. Conexão estabelecida                                                    │
│  6. PowerShell pode conectar ao Exchange Online                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Requisitos de Permissão

Para que a atribuição automática funcione, o App Registration precisa ter:

| Permissão | Propósito |
|-----------|-----------|
| `RoleManagement.ReadWrite.Directory` | Atribuir roles de diretório |

Se esta permissão não estiver concedida, o sistema:
1. Tenta a atribuição
2. Falha graciosamente
3. Loga warning nos logs
4. Funcionalidades Graph API continuam funcionando
5. PowerShell requer atribuição manual

---

## Fallback Manual

Se a atribuição automática falhar, documentar no UI:

> **Exchange Online PowerShell requer configuração adicional**
> 
> Para usar recursos do Exchange Online via PowerShell, um administrador do tenant deve atribuir a role "Exchange Administrator" ao aplicativo iScope 360 no Azure Portal:
> 
> 1. Acesse Azure Portal > Microsoft Entra ID > Roles and administrators
> 2. Selecione "Exchange Administrator"
> 3. Clique em "Add assignments"
> 4. Busque e selecione "iScope 360" (ou o nome do app)
> 5. Confirme a atribuição

---

## Benefícios

1. **Automatização**: A role é atribuída automaticamente durante o fluxo de consentimento
2. **Graceful Degradation**: Se falhar, outras funcionalidades continuam funcionando
3. **Visibilidade**: O status da role aparece na lista de permissões do tenant
4. **Documentação**: Instruções claras para atribuição manual quando necessário
