
# Plano: Corrigir Validação de Permissões para Tenants de Clientes

## Problema Identificado

A página de Tenants (Tenant Connection) mostra duas permissões com status "pendente" (bolinha amarela):
1. **RoleManagement.ReadWrite.Directory** - O endpoint de teste usa parâmetros não suportados (`$top=1&$select=id`), causando erro 400 na Graph API
2. **Exchange Administrator Role** - A função `validate-m365-connection` não inclui lógica para verificar esta atribuição de Role

## Análise Técnica

### Arquivos Envolvidos
- `supabase/functions/validate-m365-connection/index.ts` - Edge Function que valida conexões de tenants de clientes
- `src/components/m365/TenantStatusCard.tsx` - Exibe as permissões do tenant

### Root Cause
1. **RoleManagement.ReadWrite.Directory** (linha 289-295): O código testa com `roleDefinitions?$top=1&$select=id`, mas a Graph API retorna erro 400 para esse endpoint
2. **Exchange Administrator Role** (linha 47 do TenantStatusCard): Listada no frontend, mas a função `validate-m365-connection` não possui código para testar nem atualizar esta permissão

### Solução

**Arquivo 1: `supabase/functions/validate-m365-connection/index.ts`**

1. Corrigir o endpoint de teste para `RoleManagement.ReadWrite.Directory`:
   - Remover os parâmetros `$top=1&$select=id` que causam erro 400
   - Usar o endpoint base: `https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions`

2. Adicionar validação da `Exchange Administrator Role`:
   - Copiar a função `testExchangeAdminRole` da função `validate-m365-permissions`
   - Adicionar constante `EXCHANGE_ADMIN_ROLE_TEMPLATE_ID`
   - Incluir a verificação no loop de permissões
   - Salvar o resultado no banco de dados junto com as outras permissões

### Mudanças de Código

```typescript
// Adicionar constante no topo do arquivo (após REQUIRED_PERMISSIONS)
const EXCHANGE_ADMIN_ROLE_TEMPLATE_ID = '29232cdf-9323-42fd-ade2-1d097af3e4de';

// Adicionar função de teste do Exchange Admin Role
async function testExchangeAdminRole(accessToken: string, appId: string): Promise<{granted: boolean, error?: string}> {
  try {
    // Buscar o Service Principal do app
    const spResponse = await fetch(
      `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${appId}'&$select=id`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    
    if (!spResponse.ok) {
      return { granted: false, error: 'Não foi possível localizar o Service Principal' };
    }
    
    const spData = await spResponse.json();
    const spId = spData.value?.[0]?.id;
    
    if (!spId) {
      return { granted: false, error: 'Service Principal não encontrado' };
    }
    
    // Verificar se a role está atribuída
    const roleResponse = await fetch(
      `https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignments?$filter=principalId eq '${spId}' and roleDefinitionId eq '${EXCHANGE_ADMIN_ROLE_TEMPLATE_ID}'`,
      { headers: { 'Authorization': `Bearer ${accessToken}`, 'ConsistencyLevel': 'eventual' } }
    );
    
    if (roleResponse.ok) {
      const roleData = await roleResponse.json();
      return { granted: roleData.value?.length > 0 };
    }
    
    return { granted: false, error: `HTTP ${roleResponse.status}` };
  } catch (error) {
    return { granted: false, error: String(error) };
  }
}

// Corrigir a validação de RoleManagement.ReadWrite.Directory (linha 289-295)
} else if (permission === 'RoleManagement.ReadWrite.Directory') {
  // Remover $top e $select que causam erro 400
  const response = await fetch('https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  granted = response.ok;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
}

// Após o loop de REQUIRED_PERMISSIONS, adicionar teste do Exchange Admin Role
// (aproximadamente linha 395)
// Test Exchange Administrator Role assignment
const roleTestResult = await testExchangeAdminRole(accessToken, app_id);
permissionResults.push({
  name: 'Exchange Administrator Role',
  granted: roleTestResult.granted,
  required: false,
});
console.log(`Exchange Administrator Role: ${roleTestResult.granted ? 'assigned' : 'not assigned'}`);
```

## Resultado Esperado

Após a implementação:
1. **RoleManagement.ReadWrite.Directory** será validada corretamente
2. **Exchange Administrator Role** será verificada e seu status será salvo no banco
3. Ao clicar em "Testar", ambas as permissões terão seus status atualizados
4. A UI mostrará bolinhas verdes (concedida) ou amarelas/vermelhas (pendente/negada) conforme o resultado real
