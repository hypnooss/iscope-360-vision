

# Plano: Adicionar Exchange.ManageAsApp Automaticamente Antes do Admin Consent

## Diagnóstico

O fluxo de conexão **já usa Admin Consent URL** (não Device Code Flow). O Admin Consent consente TODAS as permissões do App Registration.

O problema: **Exchange.ManageAsApp não está no App Registration**, então o Admin Consent não inclui.

## Solução Simples

Adicionar `Exchange.ManageAsApp` ao App Registration **automaticamente** quando o admin iniciar a conexão de um tenant. Isso acontece **antes** de abrir a URL de Admin Consent.

## Alterações

### 1. Criar Edge Function `ensure-exchange-permission`

**Arquivo**: `supabase/functions/ensure-exchange-permission/index.ts`

Esta função:
- Busca a configuração global (app_id, app_object_id, home_tenant_id, client_secret)
- Obtém token do home tenant
- Verifica se `Exchange.ManageAsApp` já está no App Registration
- Se não estiver, adiciona automaticamente
- Retorna sucesso

```text
Endpoint: POST /ensure-exchange-permission
Resposta: { success: true, added: true/false }
```

### 2. Chamar a função antes do Admin Consent

**Arquivo**: `src/components/m365/SimpleTenantConnectionWizard.tsx`

Na função `handleStart()`, antes de abrir a URL de Admin Consent (linha ~362):

```typescript
// ANTES de abrir Admin Consent URL, garantir que Exchange.ManageAsApp está no App Registration
const { data: ensureResult, error: ensureError } = await supabase.functions.invoke('ensure-exchange-permission');

if (ensureError) {
  console.warn('Could not ensure Exchange permission, continuing anyway:', ensureError);
  // Não bloqueia - o admin pode adicionar manualmente depois
}
```

### 3. Remover código duplicado

**Arquivo**: `supabase/functions/add-exchange-permission/index.ts`

Esta função já existe mas só é chamada manualmente via Configurações. Podemos:
- Remover ela completamente
- OU: Reutilizar sua lógica na nova função

A nova função `ensure-exchange-permission` será mais simples e focada.

## Fluxo Resultante

```text
1. Admin clica "Conectar Tenant"
2. Wizard chama `ensure-exchange-permission`
   ├── Verifica se Exchange.ManageAsApp está no App Registration
   └── Se não, adiciona automaticamente
3. Wizard abre Admin Consent URL
4. Admin faz consent (Graph + Exchange incluídos)
5. Callback processa e cria tenant
6. CBA funciona automaticamente!
```

## Detalhes Técnicos

### Nova Edge Function: `ensure-exchange-permission`

```typescript
// IDs fixos do Azure
const EXCHANGE_RESOURCE_ID = "00000002-0000-0ff1-ce00-000000000000";
const EXCHANGE_MANAGE_AS_APP_ID = "dc50a0fb-09a3-484d-be87-e023b12c6440";

// 1. Buscar config global
const { data: config } = await supabase
  .from('m365_global_config')
  .select('app_id, app_object_id, home_tenant_id, client_secret_encrypted')
  .single();

// 2. Obter token do home tenant
const tokenResponse = await fetch(
  `https://login.microsoftonline.com/${config.home_tenant_id}/oauth2/v2.0/token`,
  { method: 'POST', body: new URLSearchParams({
    client_id: config.app_id,
    client_secret: await decryptSecret(config.client_secret_encrypted),
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  }) }
);

// 3. Verificar/adicionar permissão no App Registration
const appUrl = `https://graph.microsoft.com/v1.0/applications/${config.app_object_id}`;
const app = await (await fetch(appUrl, { headers: { Authorization: `Bearer ${token}` } })).json();

const hasExchange = app.requiredResourceAccess?.some(r => 
  r.resourceAppId === EXCHANGE_RESOURCE_ID &&
  r.resourceAccess?.some(p => p.id === EXCHANGE_MANAGE_AS_APP_ID)
);

if (!hasExchange) {
  // Adicionar permissão
  const permissions = app.requiredResourceAccess || [];
  permissions.push({
    resourceAppId: EXCHANGE_RESOURCE_ID,
    resourceAccess: [{ id: EXCHANGE_MANAGE_AS_APP_ID, type: 'Role' }],
  });
  
  await fetch(appUrl, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requiredResourceAccess: permissions }),
  });
}
```

### Alteração no Wizard

```typescript
// Em handleStart(), ANTES de criar a URL de Admin Consent:

// Ensure Exchange.ManageAsApp is in App Registration before consent
try {
  const { data: ensureResult, error: ensureError } = await supabase.functions.invoke('ensure-exchange-permission');
  if (ensureResult?.added) {
    console.log('Exchange.ManageAsApp permission added to App Registration');
  }
} catch (e) {
  console.warn('ensure-exchange-permission call failed, continuing:', e);
}

// Então continua com o Admin Consent URL...
```

## Vantagens

1. **Zero interação manual** - Tudo automático
2. **Transparente** - O admin não precisa saber que isso acontece
3. **Idempotente** - Pode ser chamado várias vezes sem problemas
4. **Não bloqueia** - Se falhar, o fluxo continua (admin pode configurar depois)

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `supabase/functions/ensure-exchange-permission/index.ts` | Criar (nova função) |
| `src/components/m365/SimpleTenantConnectionWizard.tsx` | Chamar função antes do consent |
| `supabase/config.toml` | Adicionar nova função |

## Validação após Consent

No `m365-oauth-callback`, já temos lógica de validação de permissões. Podemos adicionar um teste para `Exchange.ManageAsApp`:

```typescript
// Testar se Exchange.ManageAsApp foi concedido
// (via oauth2PermissionGrants ou teste direto de EWS)
```

Isso é opcional - se o consent foi feito com a permissão no App Registration, ela será concedida automaticamente.

