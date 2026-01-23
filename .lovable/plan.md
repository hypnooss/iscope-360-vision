
# Plano: Corrigir testConnection para Usar Credenciais Globais Multi-Tenant

## Contexto

O modelo Multi-Tenant funciona assim:
- **Tenant Home (iScope 360)**: possui o App Registration com `app_id` e `client_secret` armazenados em `m365_global_config`
- **Tenants Client**: fazem Admin Consent e usam as mesmas credenciais do tenant home para autenticação

## Problema Atual

A função `testConnection` em `src/hooks/useTenantConnection.ts` busca `client_secret_encrypted` apenas em `m365_app_credentials`, onde o valor é `NULL` para tenants que usam o modelo multi-tenant.

## Solução

Modificar `testConnection` para:
1. Buscar `azure_app_id` e `auth_type` de `m365_app_credentials`
2. Se `auth_type === 'multi_tenant_app'` ou `client_secret_encrypted` for `NULL`, buscar o secret de `m365_global_config`
3. Chamar a edge function com as credenciais corretas

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTenantConnection.ts` | Atualizar `testConnection` para buscar secret global quando necessário |

## Código da Correção

```typescript
const testConnection = async (tenantId: string) => {
  try {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) {
      return { success: false, error: 'Tenant não encontrado.' };
    }

    // Fetch credentials from m365_app_credentials
    const { data: credentials, error: credError } = await supabase
      .from('m365_app_credentials')
      .select('azure_app_id, client_secret_encrypted, auth_type')
      .eq('tenant_record_id', tenantId)
      .single();

    if (credError || !credentials) {
      return { 
        success: false, 
        error: 'Credenciais não encontradas. O tenant pode não ter completado o consentimento do administrador.' 
      };
    }

    let clientSecret = credentials.client_secret_encrypted;

    // If using multi-tenant app or no local secret, get the global secret
    if (credentials.auth_type === 'multi_tenant_app' || !clientSecret) {
      const { data: globalConfig, error: globalError } = await supabase
        .from('m365_global_config')
        .select('client_secret_encrypted')
        .limit(1)
        .maybeSingle();

      if (globalError || !globalConfig?.client_secret_encrypted) {
        return { 
          success: false, 
          error: 'Configuração global M365 não encontrada. Configure o App Multi-Tenant em Administração > Configurações.' 
        };
      }

      clientSecret = globalConfig.client_secret_encrypted;
    }

    // Call edge function to validate the connection
    const { data, error } = await supabase.functions.invoke('validate-m365-connection', {
      body: {
        tenant_id: tenant.tenant_id,
        app_id: credentials.azure_app_id,
        client_secret: clientSecret,
        tenant_record_id: tenantId,
      }
    });

    // ... resto da função permanece igual
  }
};
```

## Fluxo Após Correção

```text
testConnection()
    │
    ├── Busca credentials em m365_app_credentials
    │   └── azure_app_id: OK
    │   └── auth_type: 'multi_tenant_app'
    │   └── client_secret_encrypted: NULL
    │
    ├── auth_type = 'multi_tenant_app' → Busca em m365_global_config
    │   └── client_secret_encrypted: <valor_criptografado> ✅
    │
    └── Envia para edge function validate-m365-connection
        └── tenant_id, app_id, client_secret (do global)
        └── Edge function decripta e valida
        └── Atualiza status e permissões
```

## Resultado Esperado

- Botão "Testar" funciona corretamente
- Edge function recebe o `client_secret` criptografado do `m365_global_config`
- Status do tenant é atualizado para `connected` ou `partial`
- Permissões são exibidas no card do tenant
