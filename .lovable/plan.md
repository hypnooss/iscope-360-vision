

## Diagnóstico

Ambas as edge functions (`exchange-dashboard` e `collaboration-dashboard`) falham com "Failed to send a request to the Edge Function". Isso é um erro de CORS — os headers `Access-Control-Allow-Headers` estão incompletos, faltando os headers que o cliente Supabase envia automaticamente.

## Solução

Atualizar o `corsHeaders` em ambas as edge functions para incluir todos os headers necessários:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

### Arquivos modificados

1. `supabase/functions/exchange-dashboard/index.ts` — linha 5, atualizar corsHeaders
2. `supabase/functions/collaboration-dashboard/index.ts` — linha 5, atualizar corsHeaders

