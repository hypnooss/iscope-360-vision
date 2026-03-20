

## Plano: Adicionar domínio de produção ao CORS

### Problema
O domínio `https://iscope360.precisio.io` não está na lista `ALLOWED_ORIGINS` em `supabase/functions/_shared/cors.ts`. Todas as chamadas a Edge Functions feitas a partir desse domínio são bloqueadas pelo navegador (CORS).

### Solução
Adicionar `https://iscope360.precisio.io` à lista de origens permitidas.

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/_shared/cors.ts` | Adicionar `'https://iscope360.precisio.io'` ao array `ALLOWED_ORIGINS` |

Após o deploy automático das Edge Functions, o erro será resolvido.

