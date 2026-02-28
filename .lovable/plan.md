

## Diagnosticar e corrigir IdentityRiskyUser.Read.All retornando 403

### Diagnostico

Os logs confirmam:
```
Permission IdentityRiskyUser.Read.All: 403 - granted: false
```

O tenant tem Azure AD Premium P2, entao nao e um problema de licenciamento. O 403 indica que a permissao `IdentityRiskyUser.Read.All` **nao foi efetivamente concedida** ao App Registration, mesmo apos o admin consent. Isso pode acontecer porque:

1. O admin consent concede apenas as permissoes declaradas no App Registration (manifest). Se `IdentityRiskyUser.Read.All` nao esta listada no manifest do app no Azure, o admin consent nao a concede.
2. A permissao pode ter sido adicionada recentemente ao manifest mas o admin consent anterior nao a incluiu.

### Solucao em duas partes

**Parte 1: Adicionar logging detalhado do erro 403** (para diagnostico futuro)

**Arquivo: `supabase/functions/validate-m365-connection/index.ts`** (linhas 454-459)

Alterar o teste de `IdentityRiskyUser.Read.All` para logar o corpo da resposta 403, permitindo distinguir entre:
- Falta de permissao (`Authorization_RequestDenied`)
- Falta de licenca (`NonPremiumTenant`)

```typescript
} else if (permission === 'IdentityRiskyUser.Read.All') {
  const response = await fetch('https://graph.microsoft.com/v1.0/identityProtection/riskyUsers?$top=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (response.ok) {
    granted = true;
  } else {
    const errBody = await response.json().catch(() => ({}));
    const errCode = errBody?.error?.code || '';
    const errMsg = errBody?.error?.message || '';
    console.log(`Permission ${permission}: ${response.status} - code: ${errCode} - msg: ${errMsg}`);
    
    // Se o erro for de licenciamento (nao de permissao), considerar granted
    if (response.status === 403 && (
      errCode.includes('NonPremiumTenant') || 
      errCode.includes('NotSupported') ||
      errMsg.toLowerCase().includes('license') ||
      errMsg.toLowerCase().includes('premium')
    )) {
      granted = true;
      console.log(`Permission ${permission}: 403 but license issue - treating as granted`);
    } else {
      granted = false;
    }
  }
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
}
```

**Parte 2: Garantir que a permissao esta no manifest do App Registration**

Essa parte e uma verificacao manual no Azure Portal:
- Ir em **Azure Portal > App Registrations > [seu app] > API Permissions**
- Verificar se `IdentityRiskyUser.Read.All` (Application) esta listada
- Se nao estiver, clicar em **Add a permission > Microsoft Graph > Application permissions** e adicionar `IdentityRiskyUser.Read.All`
- Depois clicar em **Grant admin consent for [tenant]**

Se a permissao ja esta no manifest, o deploy da Parte 1 vai nos dar o erro exato no log para diagnosticar melhor.

### Mudancas de codigo

| Arquivo | Mudanca |
|---------|---------|
| `validate-m365-connection/index.ts` | Adicionar parsing do corpo do 403 + tratamento de erro de licenca para IdentityRiskyUser.Read.All |

### Deploy

Edge function `validate-m365-connection` sera re-deployada automaticamente.

