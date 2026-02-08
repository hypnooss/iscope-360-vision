
# Plano: Corrigir Validação das Permissões Restantes

## Problema Identificado

Os logs revelam 3 permissões não validadas corretamente:

| Permissão | Status | Log |
|-----------|--------|-----|
| Sites.Read.All | 403 | Query `?search=*` não é válida |
| Application.ReadWrite.All | pending | `app_object_id` não preenchido no banco |
| SharePoint Administrator | não atribuído | Role precisa ser atribuída manualmente |

## Correções Necessárias

### 1. Sites.Read.All - Corrigir Endpoint de Teste

O endpoint atual (`/sites?search=*`) requer parâmetro de busca válido. Alternativa mais confiável:

**Arquivo**: `supabase/functions/validate-m365-connection/index.ts` (linhas 476-481)

**Antes:**
```typescript
} else if (permission === 'Sites.Read.All') {
  const response = await fetch('https://graph.microsoft.com/v1.0/sites?search=*&$top=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  granted = response.ok;
```

**Depois:**
```typescript
} else if (permission === 'Sites.Read.All') {
  // Use root site access instead of search which requires specific terms
  const response = await fetch('https://graph.microsoft.com/v1.0/sites/root?$select=id', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  // Also try sites collection if root fails
  let sitesGranted = response.ok;
  if (!sitesGranted && response.status !== 403) {
    // Fallback: try sites collection
    const sitesResponse = await fetch('https://graph.microsoft.com/v1.0/sites?$select=id&$top=1', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    sitesGranted = sitesResponse.ok;
    console.log(`Permission ${permission} fallback: ${sitesResponse.status} - granted: ${sitesGranted}`);
  }
  granted = sitesGranted;
```

### 2. Application.ReadWrite.All - Adicionar Fallback com app_id

Se `app_object_id` não existir, podemos buscar o app registration pelo `appId`:

**Arquivo**: `supabase/functions/validate-m365-connection/index.ts` (linhas 502-539)

**Depois:**
```typescript
// Test Application.ReadWrite.All (certificate management permission)
let appObjectId: string | null = null;

// First, try to get app_object_id from m365_app_credentials
if (tenant_record_id) {
  const { data: appCreds } = await supabase
    .from('m365_app_credentials')
    .select('app_object_id, azure_app_id')
    .eq('tenant_record_id', tenant_record_id)
    .maybeSingle();
  
  appObjectId = appCreds?.app_object_id || null;
  
  // If no app_object_id stored, try to fetch from Graph using app_id
  if (!appObjectId && (appCreds?.azure_app_id || app_id)) {
    const appIdToUse = appCreds?.azure_app_id || app_id;
    console.log('Fetching app_object_id from Graph API for appId:', appIdToUse);
    
    const appLookupResponse = await fetch(
      `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${appIdToUse}'&$select=id`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (appLookupResponse.ok) {
      const appData = await appLookupResponse.json();
      appObjectId = appData.value?.[0]?.id || null;
      
      // Store the app_object_id for future use
      if (appObjectId && appCreds) {
        await supabase
          .from('m365_app_credentials')
          .update({ app_object_id: appObjectId })
          .eq('tenant_record_id', tenant_record_id);
        console.log('Stored app_object_id:', appObjectId);
      }
    } else {
      console.log('Could not fetch app from Graph:', appLookupResponse.status);
    }
  }
}

if (appObjectId) {
  console.log('Testing Application.ReadWrite.All with app_object_id:', appObjectId);
  const appResponse = await fetch(
    `https://graph.microsoft.com/v1.0/applications/${appObjectId}?$select=id,keyCredentials`,
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
  console.log('Could not determine app_object_id - marking Application.ReadWrite.All as not granted');
  permissionResults.push({
    name: 'Application.ReadWrite.All',
    granted: false,
    required: false,
  });
}
```

### 3. SharePoint Administrator - Informar Usuário

O **SharePoint Administrator** requer atribuição manual no Azure Portal:
- Enterprise Applications → iScope → Roles and administrators → SharePoint Administrator → Add assignment

Esta role **não é concedida via Admin Consent** - precisa ser atribuída manualmente. A UI já mostra corretamente que não está atribuída.

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/validate-m365-connection/index.ts` | 1. Corrigir endpoint Sites.Read.All<br>2. Adicionar fallback para buscar app_object_id via Graph API |

## Resultado Esperado

| Permissão | Antes | Depois |
|-----------|-------|--------|
| Sites.Read.All | 403 (endpoint incorreto) | ✅ 200 (usando /sites/root) |
| Application.ReadWrite.All | pending (sem app_object_id) | ✅ Busca automática do app_object_id |
| SharePoint Administrator | pending | ⚠️ Requer atribuição manual (comportamento correto) |

## Observação sobre SharePoint Administrator

A role **SharePoint Administrator** é uma **Directory Role** e deve ser atribuída manualmente no Azure Portal:

1. Azure Portal → Microsoft Entra ID
2. Enterprise applications → Selecionar "iScope Security"
3. Roles and administrators
4. Buscar "SharePoint Administrator"
5. Add assignment → Selecionar o Service Principal

Esta não é uma falha do sistema - a UI está corretamente indicando que a role não está atribuída.
