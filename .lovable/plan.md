

# Plano: Corrigir Erro 400 na Edge Function exchange-online-insights

## Problema Identificado

A Edge Function `exchange-online-insights` está falhando com erro 400 (Bad Request) ao tentar buscar usuários.

**Causa raiz**: O filtro `$filter=mail ne null` é considerado uma "advanced query" pela Microsoft Graph API e requer headers especiais que não estão sendo enviados.

**URL atual (linha 142)**:
```typescript
"https://graph.microsoft.com/v1.0/users?$filter=mail ne null&$select=id,displayName,userPrincipalName,mail&$top=100"
```

## Requisitos da Microsoft Graph API para Advanced Queries

Para usar operadores como `ne` (not equal), a API exige:
1. Header `ConsistencyLevel: eventual`
2. Query parameter `$count=true`

Sem esses elementos, a API retorna **400 Bad Request**.

## Arquivo a Modificar

`supabase/functions/exchange-online-insights/index.ts`

## Correção Técnica

Modificar a função `fetchUsersWithMailbox` (linhas 137-166) para incluir os headers e parâmetros necessários:

```typescript
// Antes (linha 141-146)
let nextLink: string | null =
  "https://graph.microsoft.com/v1.0/users?$filter=mail ne null&$select=id,displayName,userPrincipalName,mail&$top=100";

while (nextLink) {
  const fetchResponse: Response = await fetch(nextLink, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

// Depois
let nextLink: string | null =
  "https://graph.microsoft.com/v1.0/users?$filter=mail ne null&$select=id,displayName,userPrincipalName,mail&$top=100&$count=true";

while (nextLink) {
  const fetchResponse: Response = await fetch(nextLink, {
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: 'eventual'
    },
  });
```

## Mudanças Detalhadas

| Linha | Antes | Depois |
|-------|-------|--------|
| 141-142 | URL sem `$count=true` | Adicionar `&$count=true` ao final da URL |
| 145-147 | Headers com apenas `Authorization` | Adicionar header `ConsistencyLevel: 'eventual'` |

## Documentação de Referência

- [Microsoft Graph Advanced Query Capabilities](https://learn.microsoft.com/en-us/graph/aad-advanced-queries)
- O operador `ne` (not equal) é classificado como "advanced query" e requer o modo eventual consistency

## Resultado Esperado

- A chamada à API retornará status 200 em vez de 400
- Usuários com email serão listados corretamente
- Os insights do Exchange Online serão gerados normalmente

