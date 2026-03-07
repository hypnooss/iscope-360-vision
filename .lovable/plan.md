

## Diagnóstico

As edge functions `exchange-dashboard` e `collaboration-dashboard` **nunca foram deployadas** no Supabase. O código existia localmente mas não estava rodando no servidor, causando o erro "Failed to send a request to the Edge Function".

## Solução Aplicada

Acabei de fazer o deploy de ambas as edge functions. Nenhuma alteração de código é necessária -- o problema era exclusivamente de deploy.

Teste agora clicando no botão "Atualizar" nas páginas Exchange Online e Colaboração.

