

# Plano: Corrigir Configuração do Azure App Registration

## Diagnóstico Final

Após análise detalhada dos logs e documentação Microsoft, o problema foi identificado:

| Evidência | Valor |
|-----------|-------|
| Secret descriptografado? | Sim, length=40 |
| Secret sendo enviado? | Sim, via URLSearchParams |
| Resposta do Azure | AADSTS7000218 - invalid_client |

**Causa Raiz**: O **Device Code Flow é incompatível com Confidential Clients** no Azure AD.

Segundo a documentação oficial Microsoft:
> "In some authentication flow scenarios, such as the OAuth 2 device authorization grant flow, where you don't expect the client application to be confidential, allow public client flows"

## O Problema

```text
Device Code Flow + Confidential Client = ERRO

O Azure ignora o client_secret enviado porque:
1. Device Code Flow foi projetado para apps que não podem guardar secrets
2. O fluxo assume que o app é público
3. Mesmo enviando o secret, o Azure rejeita porque espera que seja um public client
```

## Solução Definitiva

**Nao e uma correcao de codigo!** O problema esta na configuracao do Azure Portal.

### Passos no Azure Portal

1. Acessar [Azure Portal](https://portal.azure.com)
2. Ir para **Microsoft Entra ID** (antigo Azure Active Directory)
3. **App registrations** → Selecionar o app `800e141d-2dd6-4fa7-b19b-4a284f584d32`
4. **Authentication** (menu lateral)
5. Na secao **Advanced settings**:
   - **Allow public client flows**: Alterar para **Yes**
6. Clicar **Save**

```text
┌─────────────────────────────────────────────────────────────┐
│  Azure Portal → App Registration → Authentication          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Advanced settings                                          │
│  ─────────────────                                          │
│                                                             │
│  Allow public client flows                                  │
│  ┌─────────────────────────────────────────┐               │
│  │  ○ No   ● Yes  ←── MUDAR PARA YES       │               │
│  └─────────────────────────────────────────┘               │
│                                                             │
│  [Save]                                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Alteracao no Codigo

Apos habilitar public client flows no Azure, o codigo deve **remover o client_secret** do polling:

### Arquivo: supabase/functions/connect-m365-tenant/index.ts

```typescript
// ANTES (linha 78-82):
const params = new URLSearchParams();
params.append('client_id', appId);
params.append('client_secret', clientSecret);  // ← REMOVER
params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
params.append('device_code', deviceCode);

// DEPOIS:
const params = new URLSearchParams();
params.append('client_id', appId);
// Sem client_secret - Public Client Flow
params.append('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
params.append('device_code', deviceCode);
```

### Simplificar pollForToken

Remover o parametro `clientSecret` da funcao e toda a logica de descriptografia no action 'poll'.

## Por que o client_secret continua sendo util?

O `client_secret` armazenado no banco **ainda sera usado** para:
- Client Credentials Flow (automacao sem usuario)
- Refresh de tokens
- Chamadas Graph API server-to-server

Apenas o Device Code Flow (autenticacao inicial) nao usa o secret.

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│              DEVICE CODE FLOW (Public Client)               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. POST /devicecode                                        │
│     Body: client_id + scope                                 │
│     Response: device_code, user_code, verification_uri      │
│                                                             │
│  2. Usuario autentica em microsoft.com/devicelogin          │
│                                                             │
│  3. POST /token (POLLING) ← SEM client_secret               │
│     Body: client_id + grant_type + device_code              │
│     Response: access_token                                  │
│                                                             │
│  4. Usar access_token para Graph API                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Resumo das Alteracoes

| Local | Acao |
|-------|------|
| **Azure Portal** | Habilitar "Allow public client flows" = Yes |
| **connect-m365-tenant/index.ts** | Remover client_secret do pollForToken |

## Ordem de Execucao

1. **PRIMEIRO**: Voce (usuario) altera a config no Azure Portal
2. **DEPOIS**: Eu altero o codigo para remover o client_secret do polling

Isso garante que nao haja janela de erro entre as mudancas.

