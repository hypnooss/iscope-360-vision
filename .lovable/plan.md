
# Plano: Corrigir Validação do Exchange Administrator Role

## Problema Identificado

Os logs mostram que a verificação encontra o Service Principal corretamente, mas retorna `Assignments found: 0` mesmo quando a role está atribuída.

**Root Cause**: A Microsoft Graph API requer **TANTO** o header `ConsistencyLevel: eventual` **QUANTO** o parâmetro `$count=true` na URL para que filtros avançados em `roleAssignments` funcionem corretamente.

O código atual tem apenas o header, mas está faltando o parâmetro `$count=true`:

```text
URL atual:    .../roleAssignments?$filter=principalId eq '...' and roleDefinitionId eq '...'
URL correta:  .../roleAssignments?$count=true&$filter=principalId eq '...' and roleDefinitionId eq '...'
```

## Solução

### Arquivo: `supabase/functions/validate-m365-connection/index.ts`

**Modificação**: Adicionar `$count=true` na URL da query de roleAssignments na função `testExchangeAdminRole`:

```typescript
// Linha 64-66 - Alterar a URL
const roleResponse = await fetch(
  `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$count=true&$filter=principalId eq '${spId}' and roleDefinitionId eq '${EXCHANGE_ADMIN_ROLE_TEMPLATE_ID}'`,
  { 
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'ConsistencyLevel': 'eventual'
    } 
  }
);
```

### Arquivo: `supabase/functions/validate-m365-permissions/index.ts`

**Modificação**: Aplicar a mesma correção na função correspondente (linha 66-68) para garantir consistência entre as duas Edge Functions:

```typescript
const roleResponse = await fetch(
  `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$count=true&$filter=principalId eq '${spId}' and roleDefinitionId eq '${EXCHANGE_ADMIN_ROLE_TEMPLATE_ID}'`,
  { 
    headers: { 
      'Authorization': `Bearer ${accessToken}`,
      'ConsistencyLevel': 'eventual'
    } 
  }
);
```

## Resultado Esperado

Após a implementação:
1. A query do roleAssignments funcionará corretamente com filtros avançados
2. Se a role Exchange Administrator estiver atribuída ao Service Principal, será detectada
3. A UI mostrará bolinha verde para "Exchange Administrator Role"
4. Clique em **"Testar"** no card do tenant para ver o resultado atualizado
