

# Plano: Corrigir Descoberta de Tenant ID

## Diagnóstico

A função `discoverTenantId` está falhando porque o regex espera encontrar o tenant ID no formato:
```
https://login.microsoftonline.com/{tenant_id}/v2.0
```

Mas a resposta real do Azure para o domínio `taschibra.onmicrosoft.com` retorna:
```
"issuer": "https://sts.windows.net/95b506fe-8de3-4aa7-8ef0-d7fe4d494bde/"
```

O regex atual (`/login\.microsoftonline\.com/`) não casa com `sts.windows.net`.

## Solução

Atualizar o regex para capturar o tenant ID de ambos os formatos possíveis de issuer:
- `https://login.microsoftonline.com/{tenant_id}/...`
- `https://sts.windows.net/{tenant_id}/`

Alternativamente, podemos extrair de `token_endpoint` que sempre tem o formato:
```
https://login.microsoftonline.com/{tenant_id}/oauth2/token
```

## Alteração

### Arquivo: `src/components/m365/SimpleTenantConnectionWizard.tsx`

Linhas 66-85 - Atualizar a função `discoverTenantId`:

```typescript
async function discoverTenantId(domain: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${domain}/.well-known/openid-configuration`
    );
    if (!response.ok) {
      console.warn('Could not discover tenant ID for domain:', domain);
      return null;
    }
    const data = await response.json();
    
    // Try to extract tenant ID from multiple sources
    // 1. Try issuer with login.microsoftonline.com format
    // 2. Try issuer with sts.windows.net format  
    // 3. Try token_endpoint as fallback
    
    const issuer = data.issuer || '';
    const tokenEndpoint = data.token_endpoint || '';
    
    // Match login.microsoftonline.com/{tenant_id}/
    let match = issuer.match(/https:\/\/login\.microsoftonline\.com\/([a-f0-9-]+)/i);
    if (match) return match[1];
    
    // Match sts.windows.net/{tenant_id}/
    match = issuer.match(/https:\/\/sts\.windows\.net\/([a-f0-9-]+)/i);
    if (match) return match[1];
    
    // Fallback: extract from token_endpoint
    match = tokenEndpoint.match(/https:\/\/login\.microsoftonline\.com\/([a-f0-9-]+)/i);
    if (match) return match[1];
    
    console.warn('Could not extract tenant ID from OpenID config:', { issuer, tokenEndpoint });
    return null;
  } catch (err) {
    console.error('Error discovering tenant ID:', err);
    return null;
  }
}
```

## Resumo

| Item | Descrição |
|------|-----------|
| Arquivo | `src/components/m365/SimpleTenantConnectionWizard.tsx` |
| Linhas | 66-85 |
| Problema | Regex não casa com `sts.windows.net` |
| Solução | Adicionar regex alternativo para `sts.windows.net` + fallback para `token_endpoint` |

## Resultado Esperado

Com esta correção, a descoberta do tenant ID funcionará para todos os formatos de resposta do Azure AD, permitindo que o domínio `taschibra.onmicrosoft.com` (que retorna tenant ID `95b506fe-8de3-4aa7-8ef0-d7fe4d494bde`) seja processado corretamente.

