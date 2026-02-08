

# Plano: Suporte a MFA via Device Code Flow

## Problema
O fluxo ROPC (Resource Owner Password Credentials) não suporta MFA - é uma limitação da Microsoft por design. Quando MFA está habilitado, o erro `AADSTS50076` é retornado.

## Solução: Device Code Flow

O Device Code Flow é o único fluxo OAuth 2.0 que:
- **Suporta MFA completamente**
- Não requer popup/browser no servidor
- O usuário autentica diretamente com a Microsoft
- Funciona com qualquer política de segurança do tenant

### Como Funciona

```text
┌─────────────────────────────────────────────────────────────────────┐
│                     DEVICE CODE FLOW                                │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Sistema solicita device_code à Microsoft                         │
│ 2. Microsoft retorna: código + URL + tempo de expiração            │
│ 3. UI exibe: "Acesse https://microsoft.com/devicelogin"            │
│                "Digite o código: ABCD-1234"                        │
│ 4. Usuário abre URL → autentica (com MFA) → digita código          │
│ 5. Sistema faz polling → recebe token quando usuário completa      │
│ 6. Fluxo continua automaticamente ✅                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

### 1. `supabase/functions/connect-m365-tenant/index.ts`

Substituir ROPC por Device Code Flow em duas etapas:

**Etapa 1 - Iniciar autenticação:**
```typescript
// POST /connect-m365-tenant com action: 'start'
// Retorna: { user_code, verification_uri, device_code, expires_in }

async function initiateDeviceCodeFlow(tenantId: string, appId: string) {
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        scope: 'https://graph.microsoft.com/.default offline_access',
      }),
    }
  );
  return await response.json();
  // Retorna: { device_code, user_code, verification_uri, expires_in, interval }
}
```

**Etapa 2 - Poll por token:**
```typescript
// POST /connect-m365-tenant com action: 'poll'
// Retorna: { success: true, ... } ou { pending: true }

async function pollForToken(tenantId: string, appId: string, deviceCode: string) {
  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: appId,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
      }),
    }
  );
  
  const data = await response.json();
  
  if (data.error === 'authorization_pending') {
    return { pending: true };
  }
  if (data.error === 'expired_token') {
    throw new Error('Tempo expirado. Tente novamente.');
  }
  
  return { access_token: data.access_token };
}
```

### 2. `src/components/m365/SimpleTenantConnectionWizard.tsx`

Adicionar novo passo de autenticação com UI para exibir código:

```text
┌─────────────────────────────────────────────────────────────────┐
│                  Autenticação Microsoft 365                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    ┌────────────────────────────────────────────────────┐        │
│    │                                                    │        │
│    │      Acesse:  microsoft.com/devicelogin           │        │
│    │                                                    │        │
│    │      Digite o código:                              │        │
│    │                                                    │        │
│    │              ┌───────────────────┐                 │        │
│    │              │   ABCD-1234       │                 │        │
│    │              └───────────────────┘                 │        │
│    │                                                    │        │
│    │      [📋 Copiar código]   [🔗 Abrir link]          │        │
│    │                                                    │        │
│    └────────────────────────────────────────────────────┘        │
│                                                                  │
│    ⏳ Aguardando autenticação... (expira em 14:23)               │
│                                                                  │
│    ─────────────────────────────────────────────────────────     │
│                                                                  │
│    ℹ️ Após fazer login no link acima (incluindo MFA se           │
│       habilitado), esta tela atualizará automaticamente.         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Novos estados do wizard:**
- `form` → Seleção de workspace + email (só para detectar tenant)
- `authenticating` → Exibe código + polling
- `connecting` → Processando conexão final
- `result` → Sucesso/Falha

### 3. Nova Edge Function (opcional): `m365-device-code-poll/index.ts`

Alternativa: fazer polling separado para não sobrecarregar a função principal.

---

## Fluxo Detalhado da UI

### Passo 1: Formulário Simplificado
- Workspace (dropdown ou auto-select)
- Email do administrador (para detectar tenant ID)
- Botão: "Continuar"

### Passo 2: Autenticação Device Code
- Exibe código grande e legível
- Botão para copiar código
- Botão para abrir link (nova aba)
- Timer de expiração visual
- Polling automático a cada 5 segundos
- Quando usuário completa → avança automaticamente

### Passo 3: Conectando
- Busca info do tenant
- Busca Service Principal
- Cria registros
- Cria task de Exchange RBAC

### Passo 4: Resultado
- Sucesso com detalhes do tenant
- Ou erro com opção de retry

---

## Vantagens

| Aspecto | ROPC (antes) | Device Code (novo) |
|---------|--------------|-------------------|
| Suporte MFA | ❌ Não | ✅ Sim |
| Segurança | ⚠️ Senha no servidor | ✅ Autenticação direta com MS |
| Conditional Access | ❌ Bloqueado | ✅ Suportado |
| Experiência | Formulário de senha | Código + link |

---

## Considerações

1. **Não precisa mais de senha** - O usuário autentica diretamente com a Microsoft
2. **Suporte completo a políticas de segurança** - MFA, Conditional Access, etc.
3. **Polling eficiente** - A cada 5 segundos (intervalo recomendado pela Microsoft)
4. **Expiração clara** - Código expira em ~15 minutos, timer visível

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/connect-m365-tenant/index.ts` | Modificar | Substituir ROPC por Device Code Flow |
| `src/components/m365/SimpleTenantConnectionWizard.tsx` | Modificar | Adicionar UI de código + polling |

---

## Código de Exemplo (Edge Function)

```typescript
// Duas ações na mesma função:

if (action === 'start') {
  // Inicia Device Code Flow
  const deviceCodeResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`,
    {
      method: 'POST',
      body: new URLSearchParams({
        client_id: appId,
        scope: 'https://graph.microsoft.com/.default',
      }),
    }
  );
  
  const { device_code, user_code, verification_uri, expires_in, interval } = 
    await deviceCodeResponse.json();
  
  return { 
    device_code,      // Guardar no client para polling
    user_code,        // Exibir para o usuário
    verification_uri, // URL para autenticar
    expires_in,       // Segundos até expirar
    interval,         // Segundos entre polls
  };
}

if (action === 'poll') {
  // Poll por token
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      body: new URLSearchParams({
        client_id: appId,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode,
      }),
    }
  );
  
  const data = await tokenResponse.json();
  
  if (data.error === 'authorization_pending') {
    return { pending: true };
  }
  
  // Usuário autenticou! Continuar com o fluxo...
  // - Buscar org info
  // - Buscar SP Object ID
  // - Criar tenant
  // - Criar task Exchange RBAC
}
```

---

## Resumo

Remove a necessidade de senha no formulário. O usuário:
1. Seleciona workspace
2. Informa email (para detectar tenant)
3. Recebe código para digitar em microsoft.com/devicelogin
4. Autentica com a Microsoft (incluindo MFA)
5. Sistema detecta automaticamente e completa a conexão

**Compatível com qualquer configuração de segurança do tenant.**

