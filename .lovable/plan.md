

# Plano: Corrigir Endpoint de Teste da Graph API no OAuth Callback

## Diagnóstico

O erro "Insufficient privileges to complete the operation" ocorre porque:

| Endpoint | Permissão Requerida | Status no Tenant |
|----------|---------------------|------------------|
| `/domains` | `Domain.Read.All` | ❌ Não concedida |
| `/organization` | `Organization.Read.All` | ✅ Concedida |

O `m365-oauth-callback` está usando `/domains` como endpoint de teste (linha 338), mas essa permissão **não está no manifest** do App Registration nem na lista `REQUIRED_PERMISSIONS`.

## Solução Proposta

Alterar o endpoint de teste da Graph API de `/domains` para `/organization`, que:
- Já funciona com `Organization.Read.All` (concedida no tenant)
- É suficiente para validar que o token está funcionando
- Também retorna o `displayName` e domínios verificados

## Alterações

### Arquivo: `supabase/functions/m365-oauth-callback/index.ts`

#### 1. Alterar teste de conexão (Linhas 334-401)

**De:**
```typescript
// Test Graph API access using /domains endpoint (more resilient than /organization)
console.log('Testing Graph API access with /domains endpoint...');

const fetchDomains = async () => {
  return await fetch('https://graph.microsoft.com/v1.0/domains', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
};
```

**Para:**
```typescript
// Test Graph API access using /organization endpoint
// Organization.Read.All is always granted via Admin Consent
console.log('Testing Graph API access with /organization endpoint...');

const fetchOrganization = async () => {
  return await fetch('https://graph.microsoft.com/v1.0/organization', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
};
```

#### 2. Ajustar processamento da resposta (Linhas 399-420)

**De:**
```typescript
const domainsData = await domainsResponse.json();
const domains = domainsData.value || [];
console.log('Domains retrieved:', domains.length);

// Extract primary domain from domains
const defaultDomain = domains.find((d: any) => d.isDefault);
...
```

**Para:**
```typescript
const orgData = await orgResponse.json();
const organization = orgData.value?.[0];
console.log('Organization retrieved:', organization?.displayName);

// Extract primary domain from organization's verified domains
const verifiedDomains = organization?.verifiedDomains || [];
const defaultDomain = verifiedDomains.find((d: any) => d.isDefault);
const initialDomain = verifiedDomains.find((d: any) => d.isInitial);
const primaryDomain = defaultDomain?.name || initialDomain?.name || verifiedDomains[0]?.name || null;
const displayName = organization?.displayName || primaryDomain;
```

## Resumo das Alterações

| Item | Descrição |
|------|-----------|
| Arquivo | `supabase/functions/m365-oauth-callback/index.ts` |
| Linhas | 334-420 |
| Problema | Usa `/domains` que requer `Domain.Read.All` não concedida |
| Solução | Usar `/organization` que funciona com `Organization.Read.All` já concedida |

## Por que isso resolve

1. A permissão `Organization.Read.All` já está concedida no tenant (visível no screenshot)
2. O endpoint `/organization` retorna o nome da organização E os domínios verificados
3. Não requer nenhuma alteração no Azure Portal ou no App Registration
4. O sistema continuará funcionando corretamente para novos tenants

## Fluxo Corrigido

```text
ANTES
─────
Token obtido → GET /domains → 403 Insufficient privileges → FALHA

DEPOIS
──────
Token obtido → GET /organization → 200 OK → Sucesso!
```

