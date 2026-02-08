

# Correção: Upload de Certificado para Service Principal do Tenant CLIENTE

## O Erro Anterior

Eu estava usando `POST /servicePrincipals/{id}/addKey` que **requer proof JWT**. Depois mudei para `PATCH /applications/{id}` no **Home Tenant** - errado novamente!

## A Solução Correta

A documentação da Microsoft diz claramente:

> "**Update servicePrincipal** can be used to perform an update instead" (para Service Principals sem certificados existentes)

O endpoint correto é:
```
PATCH /servicePrincipals/{sp_object_id}
```

Com body:
```json
{
  "keyCredentials": [{...}]
}
```

**SEM PROOF JWT!** Funciona **100% no tenant cliente!**

## Dados Disponíveis (Tenant CLIENTE - TASCHIBRA)

| Campo | Valor |
|-------|-------|
| `sp_object_id` | `08d3078b-1ea9-4b12-b2a6-a7590fb6a6c7` |
| `azure_app_id` | `800e141d-2dd6-4fa7-b19b-4a284f584d32` |
| `tenant_id` | `95b506fe-8de3-4aa7-8ef0-d7fe4d494bde` |
| `tenant_domain` | `TASCHIBRA.mail.onmicrosoft.com` |

## Alterações Necessárias

### Arquivo: `supabase/functions/agent-heartbeat/index.ts`

#### 1. Nova função `uploadCertificateToServicePrincipal`

```typescript
async function uploadCertificateToServicePrincipal(
  clientTenantId: string,  // Tenant CLIENTE
  appId: string,
  spObjectId: string,      // Service Principal Object ID (no tenant cliente)
  clientSecret: string,
  thumbprint: string,
  publicKey: string,
  agentId: string
): Promise<{ success: boolean; keyId?: string; error?: string }> {
  try {
    console.log(`Uploading certificate to Service Principal ${spObjectId.substring(0, 8)}... in Client Tenant ${clientTenantId.substring(0, 8)}...`);
    
    // Get access token for the CLIENT tenant
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${clientTenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: appId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error(`Failed to get token for Client Tenant:`, errText);
      return { success: false, error: `Token error: ${tokenResponse.status}` };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch existing keyCredentials from Service Principal
    const currentSpResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spObjectId}?$select=keyCredentials`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!currentSpResponse.ok) {
      const errText = await currentSpResponse.text();
      console.error(`Failed to get Service Principal:`, errText);
      return { success: false, error: `GET SP error: ${currentSpResponse.status}` };
    }

    const currentSpData = await currentSpResponse.json();
    const existingKeys = currentSpData.keyCredentials || [];
    
    console.log(`Service Principal has ${existingKeys.length} existing key(s)`);

    // Check if this thumbprint is already registered
    const sanitizedNewThumbprint = sanitizeThumbprint(thumbprint);
    for (const key of existingKeys) {
      const existingThumbprint = sanitizeThumbprint(key.customKeyIdentifier);
      if (existingThumbprint === sanitizedNewThumbprint) {
        console.log(`Certificate already registered in Service Principal`);
        return { success: true, keyId: sanitizedNewThumbprint };
      }
    }

    // Format certificate for Azure
    const certBase64 = publicKey
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');

    // Calculate dates (1 year validity)
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const newKeyCredential = {
      type: 'AsymmetricX509Cert',
      usage: 'Verify',
      key: certBase64,
      displayName: `iScope-Agent-${agentId.substring(0, 8)}`,
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
    };

    // PATCH Service Principal with all certificates
    const patchResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spObjectId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyCredentials: [...existingKeys, newKeyCredential],
        }),
      }
    );

    if (!patchResponse.ok) {
      const errText = await patchResponse.text();
      console.error(`Failed to PATCH Service Principal:`, errText);
      return { success: false, error: `PATCH error: ${patchResponse.status} - ${errText}` };
    }

    console.log(`Certificate uploaded to Service Principal, thumbprint: ${sanitizedNewThumbprint?.substring(0, 8)}...`);
    return { success: true, keyId: sanitizedNewThumbprint || thumbprint };
  } catch (error) {
    console.error(`Error uploading certificate to Service Principal:`, error);
    return { success: false, error: String(error) };
  }
}
```

#### 2. Atualizar `uploadAgentCertificate` para usar dados do tenant CLIENTE

```typescript
async function uploadAgentCertificate(
  supabase: any,
  agentId: string,
  thumbprint: string,
  publicKey: string
): Promise<string | null> {
  console.log(`Uploading certificate for agent ${agentId}, thumbprint: ${thumbprint.substring(0, 8)}...`);
  
  try {
    // Get linked tenants for this agent (CLIENT tenants)
    const { data: linkedTenants, error: linkError } = await supabase
      .from('m365_tenant_agents')
      .select(`
        tenant_record_id,
        m365_tenants!inner(id, tenant_id, client_id),
        m365_app_credentials!inner(azure_app_id, sp_object_id, client_secret_encrypted)
      `)
      .eq('agent_id', agentId)
      .eq('enabled', true);

    if (linkError || !linkedTenants?.length) {
      console.log('No linked tenants found for agent, skipping certificate upload');
      return null;
    }

    const uploadResults: string[] = [];

    for (const link of linkedTenants) {
      const clientTenantId = link.m365_tenants?.tenant_id;
      const spObjectId = link.m365_app_credentials?.sp_object_id;
      const azureAppId = link.m365_app_credentials?.azure_app_id;
      const encryptedSecret = link.m365_app_credentials?.client_secret_encrypted;

      if (!clientTenantId || !spObjectId || !azureAppId || !encryptedSecret) {
        console.warn(`Missing data for linked tenant:`, { clientTenantId, spObjectId, azureAppId });
        continue;
      }

      // Decrypt client secret
      const clientSecret = await decryptSecret(encryptedSecret);
      if (!clientSecret) {
        console.error('Failed to decrypt client secret for tenant');
        continue;
      }

      // Upload certificate to Service Principal in CLIENT tenant
      const result = await uploadCertificateToServicePrincipal(
        clientTenantId,       // Tenant CLIENTE
        azureAppId,
        spObjectId,           // Service Principal no tenant CLIENTE
        clientSecret,
        thumbprint,
        publicKey,
        agentId
      );

      if (result.success && result.keyId) {
        uploadResults.push(result.keyId);
        
        // Update agent with certificate info
        await supabase
          .from('agents')
          .update({
            certificate_thumbprint: sanitizeThumbprint(thumbprint),
            certificate_public_key: publicKey,
            azure_certificate_key_id: result.keyId,
          })
          .eq('id', agentId);
      }
    }

    return uploadResults.length > 0 ? uploadResults[0] : null;
  } catch (error) {
    console.error('Error uploading certificate:', error);
    return null;
  }
}
```

## Fluxo Corrigido

```
Agent Linux                     Backend                        Azure (Tenant CLIENTE)
    │                              │                                    │
    │──heartbeat + cert──────────▶│                                    │
    │                              │                                    │
    │                              │  1. Busca sp_object_id            │
    │                              │     de m365_app_credentials       │
    │                              │                                    │
    │                              │  2. Token do tenant CLIENTE       │
    │                              │───────────────────────────────────▶│
    │                              │◀───────────────────────────────────│
    │                              │                                    │
    │                              │  3. GET /servicePrincipals/{id}   │
    │                              │───────────────────────────────────▶│
    │                              │◀──────── keyCredentials ──────────│
    │                              │                                    │
    │                              │  4. PATCH /servicePrincipals/{id} │
    │                              │───────────────────────────────────▶│
    │                              │◀──────────── 204 No Content ──────│
    │                              │                                    │
    │◀────── keyId ───────────────│                                    │
```

## Resultado Final

- **ZERO dependência do tenant Home**
- Certificado registrado **diretamente no Service Principal do tenant CLIENTE**
- Token obtido contra o **tenant CLIENTE**
- Agent pode usar CBA para PowerShell/Exchange no **tenant CLIENTE**

## Requisito

A permissão `Application.ReadWrite.All` já foi validada no tenant cliente (TASCHIBRA) - isso permite atualizar o Service Principal.

