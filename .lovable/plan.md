

# Correção: Query de Upload de Certificado

NAO É PRA USAR A BUCVETA DO TENANT HOME EM NENHUMA SITUAÇÃO.
JA FALEI ISSO UMA CENTENA DE VEZES, MAS VC CONTINUA INSISTINDO NESSA BUCETA

## Problemas Identificados

### Problema 1: Query com JOIN inválido
```
Error: Could not find a relationship between 'm365_tenant_agents' and 'm365_app_credentials'
```

A query atual tenta fazer JOIN direto:
```typescript
.from('m365_tenant_agents')
.select(`
  m365_tenants!inner(...),
  m365_app_credentials!inner(...)  // ❌ Não há FK direta
`)
```

**Solução**: Aninhar `m365_app_credentials` dentro de `m365_tenants`:
```typescript
.from('m365_tenant_agents')
.select(`
  tenant_record_id,
  m365_tenants!inner(
    id, tenant_id, tenant_domain, client_id,
    m365_app_credentials!inner(azure_app_id, sp_object_id)  // ✅ Via FK correta
  )
`)
```

### Problema 2: `client_secret_encrypted` está NULL em `m365_app_credentials`

| Tabela | `client_secret_encrypted` |
|--------|---------------------------|
| `m365_global_config` | ✅ Presente (137 chars) |
| `m365_app_credentials` (TASCHIBRA) | ❌ NULL |

**Análise**: Em um App Multi-Tenant:
- O App Registration é único (no tenant Home)
- O `client_secret` é o **mesmo** para todos os tenants clientes
- O que muda é apenas o `tenant_id` usado para obter o token

**Solução**: Usar o `client_secret_encrypted` de `m365_global_config` para autenticar em qualquer tenant cliente.

---

## Alterações Necessárias

### Arquivo: `supabase/functions/agent-heartbeat/index.ts`

#### 1. Corrigir a query de linkedTenants (linhas 304-312)

```typescript
// ANTES (ERRADO):
const { data: linkedTenants, error: linkError } = await supabase
  .from('m365_tenant_agents')
  .select(`
    tenant_record_id,
    m365_tenants!inner(id, tenant_id, tenant_domain, client_id),
    m365_app_credentials!inner(azure_app_id, sp_object_id, client_secret_encrypted)
  `)
  .eq('agent_id', agentId)
  .eq('enabled', true);

// DEPOIS (CORRETO):
const { data: linkedTenants, error: linkError } = await supabase
  .from('m365_tenant_agents')
  .select(`
    tenant_record_id,
    m365_tenants!inner(
      id, 
      tenant_id, 
      tenant_domain, 
      client_id,
      m365_app_credentials(azure_app_id, sp_object_id, is_active)
    )
  `)
  .eq('agent_id', agentId)
  .eq('enabled', true);
```

#### 2. Buscar `client_secret` do `m365_global_config`

Adicionar busca do secret global no início da função `uploadAgentCertificate`:

```typescript
async function uploadAgentCertificate(
  supabase: any,
  agentId: string,
  thumbprint: string,
  publicKey: string
): Promise<string | null> {
  console.log(`Uploading certificate for agent ${agentId}, thumbprint: ${thumbprint.substring(0, 8)}...`);
  
  try {
    // Get global config with the shared client_secret
    const { data: globalConfig, error: configError } = await supabase
      .from('m365_global_config')
      .select('app_id, client_secret_encrypted')
      .single();
    
    if (configError || !globalConfig?.client_secret_encrypted) {
      console.error('No global config or client_secret found');
      return null;
    }

    // Decrypt the global client_secret
    let globalClientSecret: string;
    try {
      globalClientSecret = await decryptSecret(globalConfig.client_secret_encrypted);
    } catch (decryptError) {
      console.error('Failed to decrypt global client secret:', decryptError);
      return null;
    }

    // Get linked CLIENT tenants for this agent
    const { data: linkedTenants, error: linkError } = await supabase
      .from('m365_tenant_agents')
      .select(`
        tenant_record_id,
        m365_tenants!inner(
          id, 
          tenant_id, 
          tenant_domain, 
          client_id,
          m365_app_credentials(azure_app_id, sp_object_id, is_active)
        )
      `)
      .eq('agent_id', agentId)
      .eq('enabled', true);

    if (linkError) {
      console.error('Error fetching linked tenants:', linkError);
      return null;
    }

    // ... resto do código usando globalClientSecret
```

#### 3. Atualizar o loop para usar o secret global

```typescript
for (const link of linkedTenants) {
  const tenant = link.m365_tenants;
  const clientTenantId = tenant?.tenant_id;
  const tenantDomain = tenant?.tenant_domain;
  
  // Get active credentials for this tenant
  const creds = Array.isArray(tenant?.m365_app_credentials) 
    ? tenant.m365_app_credentials.find((c: any) => c.is_active)
    : tenant?.m365_app_credentials;
  
  const spObjectId = creds?.sp_object_id;
  const azureAppId = creds?.azure_app_id || globalConfig.app_id;

  if (!clientTenantId || !spObjectId) {
    console.warn(`Missing data for linked tenant:`, { 
      clientTenantId: clientTenantId?.substring(0, 8), 
      spObjectId: spObjectId?.substring(0, 8)
    });
    continue;
  }

  console.log(`Processing tenant ${tenantDomain || clientTenantId.substring(0, 8)}...`);

  // Upload certificate to Service Principal in CLIENT tenant
  // Using GLOBAL client_secret (same App Registration for all tenants)
  const result = await uploadCertificateToServicePrincipal(
    clientTenantId,       // Tenant CLIENTE (e.g., TASCHIBRA)
    azureAppId,
    spObjectId,           // Service Principal Object ID (in client tenant)
    globalClientSecret,   // ✅ Secret GLOBAL do App Multi-Tenant
    thumbprint,
    publicKey,
    agentId
  );
  
  // ...
}
```

---

## Fluxo Corrigido

```text
Agent Linux                     Backend                           Azure
    │                              │                                  │
    │──heartbeat + cert──────────▶│                                  │
    │                              │                                  │
    │                              │  1. Busca m365_global_config    │
    │                              │     (client_secret_encrypted)   │
    │                              │                                  │
    │                              │  2. Busca m365_tenant_agents    │
    │                              │     → m365_tenants              │
    │                              │     → m365_app_credentials       │
    │                              │       (sp_object_id)            │
    │                              │                                  │
    │                              │  3. Decrypt global secret       │
    │                              │                                  │
    │                              │  4. Token do tenant CLIENTE     │
    │                              │     (usando secret global)      │
    │                              │────────────────────────────────▶│
    │                              │◀────────────────────────────────│
    │                              │                                  │
    │                              │  5. GET /servicePrincipals/{id} │
    │                              │────────────────────────────────▶│
    │                              │◀──────── keyCredentials ────────│
    │                              │                                  │
    │                              │  6. PATCH /servicePrincipals/{id}
    │                              │────────────────────────────────▶│
    │                              │◀──────────── 204 OK ────────────│
    │                              │                                  │
    │◀────── keyId ───────────────│                                  │
```

---

## Resumo das Correções

| # | Problema | Correção |
|---|----------|----------|
| 1 | Query com JOIN inválido | Aninhar `m365_app_credentials` dentro de `m365_tenants` |
| 2 | `client_secret` NULL em `m365_app_credentials` | Usar `client_secret` de `m365_global_config` |
| 3 | Extração de dados aninhados | Ajustar código para navegar na estrutura correta |

