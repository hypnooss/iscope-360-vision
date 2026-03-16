

## Problema: Saúde do 365 não mostra dados

### Diagnóstico

A página `M365ServiceHealthPage.tsx` chama a Edge Function `m365-service-health` via React Query, mas **não tem nenhum tratamento de erro na UI**. Quando a função falha (token inválido, permissão negada, decryption falha, etc.), a query entra em estado de erro e a página fica completamente vazia — sem nenhuma mensagem ao usuário.

Os logs da Edge Function não mostram nenhuma execução recente com dados (apenas boot/shutdown), o que sugere que a função está falhando antes de logar ou retornando erro que é silenciado no frontend.

### Causa raiz provável

1. **Sem UI de erro**: A página só renderiza conteúdo quando `data` existe (linha 306). Não há bloco para `isError` / estado de falha.
2. **Falha silenciosa na Edge Function**: Pode ser falha de token (credenciais expiradas/inválidas) ou falta da permissão `ServiceHealth.Read.All` no app registration do tenant.

### Solução

| Arquivo | Mudança |
|---|---|
| `src/pages/m365/M365ServiceHealthPage.tsx` | Adicionar estado de erro visível + botão de retry |

**Mudanças específicas:**

1. Extrair `isError` e `error` do `useQuery` (já disponíveis no React Query, só não estão desestruturados).
2. Adicionar bloco de UI para `selectedTenantId && !isLoading && (isError || !data)` que exiba:
   - Ícone de erro (WifiOff ou AlertTriangle)
   - Mensagem de erro real retornada pela função (ex: "Token acquisition failed", "No credentials available")
   - Botão "Tentar novamente" que chama `refetch()`
   - Dica sobre verificar permissões `ServiceHealth.Read.All`

3. Melhorar o logging no `queryFn` para capturar erros do `supabase.functions.invoke` que retornam `data.error` sem throw.

