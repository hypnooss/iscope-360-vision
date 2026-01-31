

# Plano: Corrigir Validação da Permissão MailboxSettings.Read

## Problema Identificado

O teste da permissão `MailboxSettings.Read` está falhando com o erro:

```
ExplicitTargetMailboxIdShouldNotBeNullOrWhiteSpace - The Id is invalid.
```

**Causa raiz**: A URL atual tenta buscar `mailboxSettings` diretamente na coleção `/users`, mas a Microsoft Graph API **não suporta** a propriedade `mailboxSettings` em queries de coleção. Ela só funciona quando buscamos um usuário específico.

## Solução

Modificar a lógica de teste para:
1. Primeiro buscar um usuário válido (usando `User.Read.All` que já sabemos que funciona)
2. Depois testar `mailboxSettings` nesse usuário específico

## Arquivo a Modificar

`supabase/functions/validate-m365-permissions/index.ts`

## Mudança Técnica

Alterar o case `MailboxSettings.Read` para usar uma abordagem em duas etapas, buscando primeiro o ID de um usuário e depois testando o endpoint correto:

```typescript
// Antes (incorreto)
case 'MailboxSettings.Read':
  url = 'https://graph.microsoft.com/v1.0/users?$top=1&$select=id,mailboxSettings';
  break;

// Depois (correto)
case 'MailboxSettings.Read': {
  // Primeiro buscar um usuário
  const usersResp = await fetch(
    'https://graph.microsoft.com/v1.0/users?$top=1&$select=id',
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );
  if (!usersResp.ok) {
    await usersResp.text();
    return false;
  }
  const usersData = await usersResp.json();
  const userId = usersData.value?.[0]?.id;
  if (!userId) return false;
  
  // Agora testar mailboxSettings no usuário específico
  url = `https://graph.microsoft.com/v1.0/users/${userId}/mailboxSettings`;
  break;
}
```

## Resultado Esperado

- A permissão `MailboxSettings.Read` será validada corretamente usando o endpoint `/users/{id}/mailboxSettings`
- O indicador no Tenant Home mudará de amarelo para verde após a próxima validação

