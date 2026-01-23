

# Plano: Corrigir Inconsistência de Validação de Permissões entre Edge Functions

## Resumo do Problema

O wizard de conexão de tenant mostra que `Directory.Read.All` está faltando, mas o card do tenant mostra a permissão como OK. Isso acontece porque as duas edge functions usam **endpoints diferentes** para validar a mesma permissão.

## Causa Raiz

A edge function `m365-oauth-callback` usa o endpoint `/directoryRoles?$top=1` para testar `Directory.Read.All`, que retorna erro `Request_UnsupportedQuery` em alguns tenants. Já a `validate-m365-connection` usa `/domains?$top=1` (que funciona) com fallback para `/directoryRoles`.

## Solução Proposta

Alinhar a lógica de teste de permissões nas duas edge functions para garantir consistência.

### Alterações Necessárias

**1. Atualizar `supabase/functions/m365-oauth-callback/index.ts`**

Modificar o teste de `Directory.Read.All` para usar a mesma estratégia de `validate-m365-connection`:
- Primeiro tentar `/v1.0/domains?$top=1`
- Se falhar, usar `/v1.0/directoryRoles?$top=1` como fallback

```text
Antes:
{ permission: 'Directory.Read.All', endpoint: 'https://graph.microsoft.com/v1.0/directoryRoles?$top=1' }

Depois:
Lógica customizada que tenta /domains primeiro, depois /directoryRoles como fallback
```

### Detalhes Técnicos

A seção de testes de permissão (linhas 322-371) precisa ser refatorada para permitir lógica customizada por permissão, ao invés de usar um array simples de endpoint:permissão.

**Código proposto:**

```typescript
// Função auxiliar para testar Directory.Read.All com fallback
async function testDirectoryPermission(accessToken: string): Promise<{ granted: boolean; error?: string }> {
  // Primeiro tenta /domains (mais confiável)
  const domainsResponse = await fetch('https://graph.microsoft.com/v1.0/domains?$top=1', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  if (domainsResponse.ok) {
    return { granted: true };
  }
  
  // Fallback para /directoryRoles
  const rolesResponse = await fetch('https://graph.microsoft.com/v1.0/directoryRoles?$top=1&$select=id', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  if (rolesResponse.ok) {
    return { granted: true };
  }
  
  // Retorna o erro do último teste
  try {
    const errorBody = await rolesResponse.json();
    return { 
      granted: false, 
      error: errorBody?.error?.code || `HTTP ${rolesResponse.status}` 
    };
  } catch {
    return { granted: false, error: `HTTP ${rolesResponse.status}` };
  }
}
```

### Resultado Esperado

Após a correção:
- O wizard mostrará o mesmo status de permissões que o card do tenant
- `Directory.Read.All` será validada corretamente usando `/domains` primeiro
- A experiência do usuário será consistente em toda a aplicação

