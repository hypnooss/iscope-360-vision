
# Plano: Upload de Certificado para Service Principal do Tenant Cliente

## Descoberta

A Microsoft Graph API permite adicionar certificados **diretamente no Service Principal** usando:
```
POST /servicePrincipals/{id}/addKey
```

Isso funciona **100% no tenant cliente**, sem precisar do App Registration no tenant Home!

## Problema Atual

O código atual tenta:
1. Buscar `app_object_id` de `m365_app_credentials` → está NULL
2. Fazer `PATCH /applications/{id}` → endpoint errado (App Registration)

## Solução

Usar o `sp_object_id` (Service Principal) que a validação já descobriu, e o endpoint `addKey`:

```
POST /servicePrincipals/{sp_object_id}/addKey
```

## Dados Necessários

| Campo | Fonte | Valor |
|-------|-------|-------|
| `sp_object_id` | `m365_app_credentials.sp_object_id` | Já descoberto na validação |
| `tenant_id` | `m365_tenants.tenant_id` | ID do tenant cliente |
| `azure_app_id` | `m365_app_credentials.azure_app_id` | App ID do aplicativo |

## Alterações

### Arquivo: `supabase/functions/agent-heartbeat/index.ts`

#### 1. Nova função para upload via Service Principal (substituir `uploadCertificateToTenantApp`)

```typescript
async function uploadCertificateToServicePrincipal(
  tenantId: string,
  appId: string,
  spObjectId: string,  // Service Principal Object ID (no tenant cliente)
  clientSecret: string,
  thumbprint: string,
  publicKey: string,
  agentId: string
): Promise<{ success: boolean; keyId?: string; error?: string }> {
  try {
    console.log(`Uploading certificate to Service Principal ${spObjectId.substring(0, 8)}... in tenant ${tenantId}`);
    
    // Get access token for the client tenant
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
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
      console.error(`Failed to get token for tenant ${tenantId}:`, errText);
      return { success: false, error: `Token error: ${tokenResponse.status}` };
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Format certificate for Azure (base64 without headers)
    const certBase64 = publicKey
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '');

    // Use addKey endpoint on Service Principal
    const addKeyResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals/${spObjectId}/addKey`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyCredential: {
            type: 'AsymmetricX509Cert',
            usage: 'Verify',
            key: certBase64,
            displayName: `iScope-Agent-${agentId.substring(0, 8)}`,
          },
          passwordCredential: null,
          proof: null, // Not needed when using client_credentials flow
        }),
      }
    );

    if (!addKeyResponse.ok) {
      const errText = await addKeyResponse.text();
      console.error(`Failed to add key to Service Principal ${spObjectId}:`, errText);
      return { success: false, error: `AddKey error: ${addKeyResponse.status} - ${errText}` };
    }

    const keyData = await addKeyResponse.json();
    const keyId = keyData.keyId || `sp-${tenantId.substring(0, 8)}-${thumbprint.substring(0, 8)}`;
    
    console.log(`Certificate uploaded to Service Principal, keyId: ${keyId}`);
    return { success: true, keyId };
  } catch (error) {
    console.error(`Error uploading certificate to Service Principal:`, error);
    return { success: false, error: String(error) };
  }
}
```

#### 2. Atualizar `uploadAgentCertificate` para usar `sp_object_id`

Linha 298-306 - Mudar o select para buscar `sp_object_id`:

```typescript
const { data: linkedTenants, error: linkError } = await supabase
  .from('m365_tenant_agents')
  .select(`
    tenant_record_id,
    m365_tenants!inner(id, tenant_id, client_id),
    m365_app_credentials!inner(azure_app_id, sp_object_id)
  `)
  .eq('agent_id', agentId)
  .eq('enabled', true);
```

Linha 313-331 - Usar `sp_object_id` e a nova função:

```typescript
for (const link of linkedTenants) {
  const tenantId = link.m365_tenants?.tenant_id;
  const spObjectId = link.m365_app_credentials?.sp_object_id;
  const azureAppId = link.m365_app_credentials?.azure_app_id;

  if (!tenantId || !spObjectId || !azureAppId) {
    console.warn(`Missing data for linked tenant:`, { tenantId, spObjectId, azureAppId });
    continue;
  }

  const result = await uploadCertificateToServicePrincipal(
    tenantId,
    azureAppId,
    spObjectId,  // Service Principal no tenant cliente
    clientSecret,
    thumbprint,
    publicKey,
    agentId
  );

  if (result.success && result.keyId) {
    uploadResults.push(result.keyId);
  }
}
```

#### 3. Remover fallback para Home Tenant

Remover linhas 355-387 (fallback para home_tenant) - não é mais necessário.

## Fluxo Final

```
Agent Linux                     Backend                        Azure (Tenant Cliente)
    │                              │                                    │
    │──heartbeat + cert──────────▶│                                    │
    │                              │                                    │
    │                              │  1. Busca sp_object_id            │
    │                              │     de m365_app_credentials       │
    │                              │                                    │
    │                              │  2. Token do tenant cliente       │
    │                              │───────────────────────────────────▶│
    │                              │◀───────────────────────────────────│
    │                              │                                    │
    │                              │  3. POST /servicePrincipals/      │
    │                              │     {sp_object_id}/addKey         │
    │                              │───────────────────────────────────▶│
    │                              │                                    │
    │                              │◀──────────────── 200 OK ──────────│
    │                              │                                    │
    │◀────── keyId ───────────────│                                    │
```

## Pré-requisito

O `sp_object_id` precisa estar salvo em `m365_app_credentials`. A função `validate-m365-connection` já foi atualizada para salvá-lo.

## Resultado

- Certificado é adicionado **diretamente no Service Principal do tenant cliente**
- Zero dependência do tenant Home
- Agent pode usar CBA para PowerShell/Exchange no tenant cliente
