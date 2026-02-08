
# Plano: Corrigir Redirecionamento de Erro OAuth e Propagação do Admin Consent

## Diagnóstico

### Problema 1: Toast de erro aparecendo na página de Login
O fluxo atual:
1. Edge function `m365-oauth-callback` redireciona para `${redirect_url}?error=...` (que é `/scope-m365/tenant-connection`)
2. `TenantConnectionPage` carrega e dispara o toast de erro via query params
3. Logo depois, outro useEffect detecta que o usuário não está autenticado e redireciona para `/auth`
4. O toast já disparado permanece visível na tela de login

A URL de redirecionamento deveria ser `/scope-m365/oauth-callback` (a página dedicada para callbacks), não `/scope-m365/tenant-connection`.

### Problema 2: Erro de propagação do Admin Consent
A mensagem "The identity of the calling application could not be established" indica que o Admin Consent ainda não propagou nos servidores do Azure AD. A edge function já implementa retries (5s, 10s, 15s = 30s total), mas em alguns casos isso não é suficiente.

---

## Solucao

### Parte 1: Corrigir URL de Redirecionamento na Edge Function

No arquivo `supabase/functions/m365-oauth-callback/index.ts`, as linhas 389-394 redirecionam para `${redirect_url}` em caso de erro da Graph API, mas o `redirect_url` aponta para `/tenant-connection`.

Alterar para usar a logica de substituicao consistente:

```typescript
// Linha ~389-394: Ao redirecionar em caso de erro Graph
const errorRedirectUrl = redirect_url.replace('/tenant-connection', '/oauth-callback');

return new Response(null, {
  status: 302,
  headers: {
    'Location': `${errorRedirectUrl}?error=graph_access_failed&error_description=${encodeURIComponent(...)}`,
  },
});
```

### Parte 2: Aumentar Tempo de Retry para Propagacao

Aumentar os delays de retry para dar mais tempo ao Azure AD propagar:
- Atual: 5s, 10s, 15s (total 30s)
- Novo: 10s, 20s, 30s (total 60s)

```typescript
// Linha ~343: Aumentar delays
const delays = [10000, 20000, 30000];
```

### Parte 3: Melhorar Mensagem de Erro para Usuario

Atualizar a mensagem de erro para ser mais informativa:

```typescript
`${finalError.message || 'Unknown error'}. O Admin Consent pode levar até 5 minutos para propagar. Aguarde e tente reconectar.`
```

---

## Arquivos a Modificar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `supabase/functions/m365-oauth-callback/index.ts` | EDIT | Corrigir redirect URL + aumentar delays + melhorar mensagem |

## Secao Tecnica

### Alteracao 1: Linha 389-394 (Redirecionamento de erro Graph)

Antes:
```typescript
return new Response(null, {
  status: 302,
  headers: {
    'Location': `${redirect_url}?error=graph_access_failed&error_description=${encodeURIComponent(`Failed to access Microsoft Graph API after retries: ${finalError.message || 'Unknown error'}. O Admin Consent pode levar alguns minutos para propagar. Tente novamente em 2-3 minutos.`)}`,
  },
});
```

Depois:
```typescript
const errorRedirectUrl = redirect_url.replace('/tenant-connection', '/oauth-callback');

return new Response(null, {
  status: 302,
  headers: {
    'Location': `${errorRedirectUrl}?error=graph_access_failed&error_description=${encodeURIComponent(`Failed to access Microsoft Graph API after retries: ${finalError.message || 'Unknown error'}. O Admin Consent pode levar até 5 minutos para propagar. Aguarde e tente reconectar.`)}`,
  },
});
```

### Alteracao 2: Linha 343 (Delays de retry)

Antes:
```typescript
const delays = [5000, 10000, 15000];
```

Depois:
```typescript
const delays = [10000, 20000, 30000];
```

### Alteracao 3: Linha 306-311 (Erro de token - tambem precisa corrigir redirect)

Antes:
```typescript
return new Response(null, {
  status: 302,
  headers: {
    'Location': `${redirect_url}?error=token_failed&error_description=${encodeURIComponent('Failed to obtain access token. Admin consent may not have been granted.')}`,
  },
});
```

Depois:
```typescript
const tokenErrorRedirectUrl = redirect_url.replace('/tenant-connection', '/oauth-callback');

return new Response(null, {
  status: 302,
  headers: {
    'Location': `${tokenErrorRedirectUrl}?error=token_failed&error_description=${encodeURIComponent('Falha ao obter token de acesso. Verifique se o Admin Consent foi concedido corretamente.')}`,
  },
});
```

---

## Resultado Esperado

1. Erros de OAuth serao exibidos na pagina `/oauth-callback` dedicada, nao mais na pagina de login
2. A propagacao do Admin Consent tera mais tempo para completar (ate 60s de retries)
3. Mensagens de erro serao mais claras e em portugues

## Fluxo Corrigido

```text
ANTES (Quebrado)
────────────────
m365-oauth-callback → /tenant-connection?error=... → toast → /auth (toast visivel)

DEPOIS (Corrigido)
──────────────────
m365-oauth-callback → /oauth-callback?error=... → pagina de erro dedicada
```
