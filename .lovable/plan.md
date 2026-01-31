
# Plano: Adicionar Permissões do Exchange Online

## Contexto

O módulo Exchange Online requer duas novas permissões do Microsoft Graph que ainda não estão listadas no sistema:

| Permissão | Tipo | Descrição | Módulo |
|-----------|------|-----------|--------|
| `MailboxSettings.Read` | Application | Ler regras de inbox e configurações de mailbox | Exchange Online |
| `Mail.Read` | Application | Acessar messageRules para análise de regras | Exchange Online |

Essas permissões precisam ser adicionadas em dois locais:
1. **Tenant Home (Admin)** - Onde o super admin configura o App Registration do iScope
2. **Conexão com Tenant do Cliente** - Onde as permissões são solicitadas e validadas

## Arquivos a Modificar

### 1. Configurações do Tenant Home (Admin)

#### `src/pages/admin/SettingsPage.tsx`

Adicionar as duas permissões na lista `defaultPermissions` com indicação visual de que são específicas do Exchange Online:

```typescript
// Linha 61-71 - Adicionar ao array defaultPermissions:
const defaultPermissions: PermissionStatus[] = [
  // Core permissions
  { name: 'User.Read.All', granted: false, type: 'required' },
  { name: 'Directory.Read.All', granted: false, type: 'required' },
  { name: 'Organization.Read.All', granted: false, type: 'required' },
  { name: 'Domain.Read.All', granted: false, type: 'required' },
  
  // Entra ID / Security
  { name: 'Group.Read.All', granted: false, type: 'recommended' },
  { name: 'Application.Read.All', granted: false, type: 'recommended' },
  { name: 'Policy.Read.All', granted: false, type: 'recommended' },
  { name: 'Reports.Read.All', granted: false, type: 'recommended' },
  { name: 'RoleManagement.Read.Directory', granted: false, type: 'recommended' },
  
  // Exchange Online (NOVO)
  { name: 'MailboxSettings.Read', granted: false, type: 'recommended' },
  { name: 'Mail.Read', granted: false, type: 'recommended' },
];
```

Na seção de exibição das permissões, adicionar uma terceira coluna ou subseção "Exchange Online" para mostrar essas permissões de forma separada, deixando claro que são específicas do módulo.

#### `supabase/functions/validate-m365-permissions/index.ts`

Adicionar as permissões nas listas e incluir testes:

```typescript
// Linha 22-27 - Adicionar ao RECOMMENDED_PERMISSIONS:
const RECOMMENDED_PERMISSIONS = [
  'Group.Read.All',
  'Application.Read.All',
  'Policy.Read.All',
  'RoleManagement.Read.Directory',
  // Exchange Online
  'MailboxSettings.Read',
  'Mail.Read',
];

// Linha 93-125 - Adicionar casos no switch testPermission():
case 'MailboxSettings.Read':
  url = 'https://graph.microsoft.com/v1.0/users?$top=1&$select=mailboxSettings';
  break;
case 'Mail.Read':
  url = 'https://graph.microsoft.com/v1.0/users?$top=1&$select=id';
  // Alternativa: testar acesso a messageRules
  break;
```

---

### 2. Conexão com Tenant do Cliente

#### `src/components/m365/TenantConnectionWizard.tsx`

Adicionar as permissões na lista exibida ao cliente (linha 565-610), com uma nova subseção "Exchange Online":

```tsx
// Adicionar após a lista de permissões atuais:
<div className="space-y-2 pt-2 border-t border-border/30 mt-2">
  <p className="text-xs font-medium text-muted-foreground">
    Exchange Online (para análise de mailbox):
  </p>
  <ul className="text-xs text-muted-foreground space-y-1">
    <li className="flex items-center gap-2">
      <CheckCircle className="w-3 h-3 text-green-500" />
      MailboxSettings.Read - Ler configurações de mailbox
    </li>
    <li className="flex items-center gap-2">
      <CheckCircle className="w-3 h-3 text-green-500" />
      Mail.Read - Ler regras de inbox
    </li>
  </ul>
</div>
```

#### `supabase/functions/m365-oauth-callback/index.ts`

Adicionar as permissões na lista e nos testes:

```typescript
// Linha 15-22 - Adicionar ao REQUIRED_PERMISSIONS:
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'Policy.Read.All',
  // Exchange Online
  'MailboxSettings.Read',
  'Mail.Read',
];

// Linha 355-362 - Adicionar ao array permissionTests:
{ 
  permission: 'MailboxSettings.Read', 
  endpoint: 'https://graph.microsoft.com/v1.0/users?$top=1&$select=mailboxSettings' 
},
{ 
  permission: 'Mail.Read', 
  endpoint: 'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules?$top=1' 
},
```

#### `supabase/functions/validate-m365-connection/index.ts`

Adicionar as permissões na lista e nos testes:

```typescript
// Linha 23-29 - Adicionar ao REQUIRED_PERMISSIONS:
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  // Exchange Online
  'MailboxSettings.Read',
  'Mail.Read',
];

// Dentro do loop de testes (linha 227-296):
} else if (permission === 'MailboxSettings.Read') {
  const response = await fetch('https://graph.microsoft.com/v1.0/users?$top=1&$select=mailboxSettings', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  granted = response.ok;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
} else if (permission === 'Mail.Read') {
  // Testar acesso a messageRules de um usuário
  const usersResponse = await fetch('https://graph.microsoft.com/v1.0/users?$top=1&$select=id', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (usersResponse.ok) {
    const usersData = await usersResponse.json();
    const userId = usersData.value?.[0]?.id;
    if (userId) {
      const rulesResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/mailFolders/inbox/messageRules?$top=1`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      granted = rulesResponse.ok;
    }
  }
  console.log(`Permission ${permission}: granted: ${granted}`);
}
```

---

## Interface Visual Proposta

### Tenant Home (Admin) - Página de Configurações

Reorganizar a seção de permissões em 3 colunas/grupos:

```text
+-----------------------------------------------------------+
| Permissões do Microsoft Graph Necessárias:                |
+-----------------------------------------------------------+
|                                                           |
| Obrigatórias (Core)        | Entra ID / Security         |
| ● User.Read.All            | ● Group.Read.All            |
| ● Directory.Read.All       | ● Application.Read.All      |
| ● Organization.Read.All    | ● Policy.Read.All           |
| ● Domain.Read.All          | ● Reports.Read.All          |
|                            | ● RoleManagement.Read.Dir   |
|                            |                             |
| Exchange Online            |                             |
| ● MailboxSettings.Read     |                             |
| ● Mail.Read                |                             |
+-----------------------------------------------------------+
```

### Conexão com Tenant do Cliente - Wizard

```text
+-----------------------------------------------------------+
| Permissões solicitadas (somente leitura):                 |
+-----------------------------------------------------------+
|                                                           |
| Obrigatórias:                                             |
| ✓ User.Read.All - Ler todos os usuários                   |
| ✓ Directory.Read.All - Ler diretório (roles, unidades)    |
| ✓ Group.Read.All - Ler todos os grupos                    |
| ✓ Application.Read.All - Ler aplicativos                  |
| ✓ AuditLog.Read.All - Ler logs de auditoria               |
| ✓ Policy.Read.All - Ler políticas de segurança            |
|                                                           |
| Exchange Online:                                          |
| ✓ MailboxSettings.Read - Ler configurações de mailbox     |
| ✓ Mail.Read - Ler regras de inbox                         |
|                                                           |
| Opcionais (requer Azure AD Premium):                      |
| ○ Reports.Read.All - Relatórios de MFA                    |
+-----------------------------------------------------------+
```

---

## Sequência de Implementação

| Etapa | Arquivo | Modificação |
|-------|---------|-------------|
| 1 | `src/pages/admin/SettingsPage.tsx` | Adicionar permissões e reorganizar UI em grupos |
| 2 | `supabase/functions/validate-m365-permissions/index.ts` | Adicionar permissões e testes |
| 3 | `src/components/m365/TenantConnectionWizard.tsx` | Adicionar seção Exchange Online na lista de permissões |
| 4 | `supabase/functions/m365-oauth-callback/index.ts` | Adicionar permissões e testes |
| 5 | `supabase/functions/validate-m365-connection/index.ts` | Adicionar permissões e testes |
| 6 | Deploy das edge functions modificadas | Garantir que as novas funções estejam ativas |

---

## Resultado Esperado

- Novas permissões `MailboxSettings.Read` e `Mail.Read` visíveis na configuração do Admin
- Permissões claramente identificadas como específicas do módulo Exchange Online
- Validação funcional das novas permissões em todos os fluxos
- Cliente informado sobre as permissões específicas do Exchange durante a conexão
- Compatibilidade mantida com tenants que não usam Exchange Online (permissões são recomendadas, não obrigatórias)
