
# Plano: Suporte a Certificados para Tenants Multi-Tenant

## Contexto do Problema

No fluxo atual:
1. O Agent gera um certificado local
2. No heartbeat, o certificado é enviado ao Azure
3. O `agent-heartbeat` usa `m365_global_config` (app_object_id + home_tenant_id) para fazer upload
4. O certificado é registrado no App Registration do **HOME tenant**
5. O PowerShell tenta conectar ao **TENANT DO CLIENTE** onde o certificado NÃO existe
6. **Resultado**: Falha de autenticação

## Arquitetura Proposta

### Fluxo Corrigido

```
1. OAuth Callback no tenant do cliente
   ↓
2. Busca App Registration Object ID via GET /applications(appId='...')
   ↓
3. Salva app_object_id em m365_app_credentials
   ↓
4. Agent gera certificado e envia no heartbeat
   ↓
5. Agent-heartbeat verifica se agent tem tenants vinculados
   ↓
6. Para cada tenant vinculado, faz upload do certificado no App Registration do cliente
   ↓
7. PowerShell usa o certificado para conectar ao tenant do cliente
```

## Alterações Necessárias

### 1. Schema: Adicionar `app_object_id` em `m365_app_credentials`

```sql
ALTER TABLE m365_app_credentials 
ADD COLUMN IF NOT EXISTS app_object_id TEXT;

COMMENT ON COLUMN m365_app_credentials.app_object_id IS 
'Object ID do App Registration no tenant do cliente. Necessário para PATCH /applications/{id} via Graph API para upload de certificados.';
```

### 2. Edge Function: `m365-oauth-callback`

**Arquivo**: `supabase/functions/m365-oauth-callback/index.ts`

**Mudança**: Após obter o token, buscar o App Registration Object ID usando:
```typescript
// Buscar App Registration Object ID (diferente do Service Principal)
const appRegResponse = await fetch(
  `https://graph.microsoft.com/v1.0/applications(appId='${appId}')?$select=id,displayName`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);

if (appRegResponse.ok) {
  const appRegData = await appRegResponse.json();
  const appObjectId = appRegData.id;
  console.log('App Registration Object ID:', appObjectId);
}
```

**Salvar** o `app_object_id` junto com o `sp_object_id` no upsert de `m365_app_credentials`.

### 3. Edge Function: `agent-heartbeat`

**Arquivo**: `supabase/functions/agent-heartbeat/index.ts`

**Mudança na função `uploadAgentCertificate`**:

Em vez de usar apenas `m365_global_config`, verificar se o agent tem tenants vinculados e fazer upload para cada um:

```typescript
async function uploadAgentCertificate(
  supabase: any,
  agentId: string,
  thumbprint: string,
  publicKey: string
): Promise<string | null> {
  // 1. Verificar se o agent tem tenants vinculados
  const { data: linkedTenants } = await supabase
    .from('m365_tenant_agents')
    .select(`
      tenant_record_id,
      m365_tenants!inner(id, tenant_id, client_id),
      m365_app_credentials!inner(azure_app_id, app_object_id)
    `)
    .eq('agent_id', agentId)
    .eq('enabled', true);

  if (linkedTenants?.length > 0) {
    // Upload para cada tenant vinculado
    for (const link of linkedTenants) {
      await uploadCertificateToTenantApp(
        link.m365_tenants.tenant_id,
        link.m365_app_credentials.azure_app_id,
        link.m365_app_credentials.app_object_id,
        thumbprint,
        publicKey
      );
    }
    return `tenant-certs-${linkedTenants.length}`;
  }

  // 2. Fallback: usar m365_global_config (comportamento atual)
  const { data: globalConfig } = await supabase
    .from('m365_global_config')
    .select('app_id, app_object_id, client_secret_encrypted, home_tenant_id')
    .limit(1)
    .single();

  // ... código existente para upload no home tenant
}
```

### 4. Obtenção de Token para Tenant do Cliente

O upload de certificado requer um token com permissão `Application.ReadWrite.All` no tenant do cliente. Usaremos Client Credentials Flow com o próprio App ID do cliente:

```typescript
async function getClientTenantToken(
  tenantId: string,
  appId: string,
  clientSecret: string
): Promise<string> {
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: clientSecret, // Decriptografado do global config (multi-tenant app)
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}
```

**Nota**: O client_secret vem do `m365_global_config` (app multi-tenant), mas o token é obtido no contexto do tenant do cliente.

## Resumo de Alterações

| Item | Tipo | Descrição |
|------|------|-----------|
| `m365_app_credentials.app_object_id` | MIGRATION | Nova coluna para Object ID do App Registration |
| `m365-oauth-callback` | EDIT | Buscar e salvar `app_object_id` via `/applications(appId=...)` |
| `agent-heartbeat` | EDIT | Lógica de upload para tenants vinculados + fallback para global |

## Fluxo Final

```
┌─────────────────────────────────────────────────────────────────┐
│                        OAUTH CALLBACK                           │
├─────────────────────────────────────────────────────────────────┤
│ 1. Obtém token do tenant do cliente                             │
│ 2. GET /applications(appId='...') → app_object_id               │
│ 3. GET /servicePrincipals?filter=appId eq '...' → sp_object_id  │
│ 4. Salva ambos em m365_app_credentials                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT HEARTBEAT                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Agent envia certificado no body                              │
│ 2. Verifica m365_tenant_agents para tenants vinculados          │
│ 3. Para cada tenant:                                            │
│    - Obtém token via Client Credentials (tenant do cliente)     │
│    - PATCH /applications/{app_object_id} com keyCredentials     │
│ 4. Se nenhum tenant vinculado: usa m365_global_config (fallback)│
│ 5. Atualiza agents.azure_certificate_key_id                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    POWERSHELL CONNECTION                        │
├─────────────────────────────────────────────────────────────────┤
│ Connect-ExchangeOnline                                          │
│   -CertificateThumbprint $thumbprint                            │
│   -AppId $azure_app_id (do tenant do cliente)                   │
│   -Organization $tenant_domain                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Considerações

1. **Permissão Necessária**: O App Registration no tenant do cliente precisa ter `Application.ReadWrite.All` (ou `Application.ReadWrite.OwnedBy`) com Admin Consent para permitir o upload de certificados.

2. **Client Secret Compartilhado**: O app multi-tenant usa o mesmo client_secret em todos os tenants, então podemos reutilizar o secret do `m365_global_config`.

3. **Fallback**: Se o agent não tiver tenants vinculados, continua usando o comportamento atual (upload no home tenant).
