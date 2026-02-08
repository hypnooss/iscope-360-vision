

# Plano: Corrigir Autenticação Device Code Flow - Modo Público

## Diagnóstico

Os logs revelam que o `client_secret` está sendo enviado (40 chars, qT...P6), mas o Azure retorna **401 Unauthorized**. Isso indica:

1. O App Registration no Azure está configurado como **"Allow public client flows: Yes"**
2. Quando um app está como público, o Azure **ignora o client_secret** e retorna erro

## Solução

Oferecer **duas abordagens** para resolver - o usuário pode escolher qual se aplica:

### Opção A: Usar como App Público (Recomendado para Device Code Flow)

Remover o `client_secret` do polling request, já que o Device Code Flow é ideal para apps públicos.

```text
Alteração em: supabase/functions/connect-m365-tenant/index.ts

ANTES (pollForToken):
  params.append('client_id', appId);
  params.append('client_secret', clientSecret);  // ← REMOVER
  params.append('grant_type', '...');
  params.append('device_code', deviceCode);

DEPOIS:
  params.append('client_id', appId);
  // client_secret removido - app público
  params.append('grant_type', '...');
  params.append('device_code', deviceCode);
```

**Requisitos no Azure Portal:**
- App Registration → Authentication → "Allow public client flows" = **Yes**
- Nenhum client_secret necessário para este fluxo

### Opção B: Manter como App Confidencial

Se o app precisa ser confidencial (para outros fluxos que usam o secret):

1. **Verificar no Azure Portal** se o secret está válido e não expirado
2. **Gerar novo secret** se necessário
3. **Atualizar a configuração M365** com o novo secret

---

## Recomendação

**Usar Opção A (App Público)** porque:

1. Device Code Flow é projetado para apps públicos
2. Mais seguro - não envia secret pela rede
3. O app já parece estar configurado como público no Azure
4. Outros fluxos (como Client Credentials para Graph API) podem usar o secret separadamente

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/connect-m365-tenant/index.ts` | Remover `client_secret` do `pollForToken` |

---

## Código da Correção

```typescript
// pollForToken - Versão App Público
async function pollForToken(
  tenantId: string, 
  appId: string, 
  deviceCode: string  // Remover clientSecret do parâmetro
): Promise<{ 
  pending?: boolean; 
  expired?: boolean; 
  access_token?: string;
  error?: string;
}> {
  const params = new URLSearchParams();
  params.append('client_id', appId);
  // NÃO enviar client_secret - app público
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
  params.append('device_code', deviceCode);
  
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    }
  );

  const data = await response.json();
  // ... resto do handling
}
```

E remover a descriptografia do secret no action 'poll':

```typescript
if (action === 'poll') {
  // Remover toda a lógica de descriptografia do secret
  // Chamar pollForToken sem o clientSecret
  const pollResult = await pollForToken(providedTenantId, globalConfig.app_id, deviceCode);
  // ...
}
```

---

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────────┐
│                    DEVICE CODE FLOW (App Público)              │
├────────────────────────────────────────────────────────────────┤
│ 1. POST /devicecode                                            │
│    → client_id + scope                                         │
│    ← device_code, user_code, verification_uri                  │
│                                                                │
│ 2. Usuário autentica em microsoft.com/devicelogin              │
│                                                                │
│ 3. POST /token (POLLING)                                       │
│    → client_id + grant_type + device_code                      │
│    → SEM client_secret (app público)                           │
│    ← access_token (após autenticação)                          │
└────────────────────────────────────────────────────────────────┘
```

---

## Validação

Após a correção, o fluxo deve:
1. Iniciar Device Code Flow ✓ (já funciona)
2. Usuário autenticar no portal Microsoft ✓ (já funciona)  
3. Polling receber o token ← (corrigido)
4. Continuar com criação do tenant ← (já implementado)

