

# Plano: Organizar Permissões nos Cards de Tenant

## Contexto

Atualmente, as permissões nos cards de tenant (página Microsoft 365 > Tenants) são exibidas em uma lista simples sem agrupamento. O objetivo é replicar o layout organizado da página de Configurações (Settings), que agrupa as permissões em 4 categorias:

1. **Obrigatórias (Core)** - Permissões fundamentais
2. **Entra ID / Security** - Segurança e identidade
3. **Exchange Online** - Recursos de email
4. **Upload de Certificados** - Gestão de certificados

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/m365/TenantStatusCard.tsx` | Reorganizar exibição de permissões por categoria |

---

## Mudança Detalhada

### `TenantStatusCard.tsx`

**1. Adicionar constantes de agrupamento** (após linha 40):
```typescript
// Permission categories for organized display
const CORE_PERMISSIONS = ['User.Read.All', 'Directory.Read.All', 'Organization.Read.All', 'Domain.Read.All', 'RoleManagement.ReadWrite.Directory'];
const ENTRA_ID_PERMISSIONS = ['Group.Read.All', 'Application.Read.All', 'Policy.Read.All', 'Reports.Read.All', 'RoleManagement.Read.Directory'];
const EXCHANGE_PERMISSIONS = ['MailboxSettings.Read', 'Mail.Read'];
const CERTIFICATE_PERMISSIONS = ['Application.ReadWrite.All'];
```

**2. Adicionar função auxiliar para filtrar permissões** (após as constantes):
```typescript
// Helper to get permissions by category
const getPermissionsByCategory = (perms: TenantPermission[], categoryList: string[]) => {
  return perms.filter(p => categoryList.includes(p.permission_name));
};
```

**3. Substituir a seção de permissões** (linhas 309-330) por layout organizado em 4 colunas:
```typescript
{showPermissions && (
  <div className="mt-3">
    <p className="text-xs text-muted-foreground mb-3">Permissões do Microsoft Graph</p>
    <div className="grid gap-4 md:grid-cols-4">
      {/* Core Permissions */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Obrigatórias (Core)</p>
        <ul className="text-sm space-y-1">
          {CORE_PERMISSIONS.map(permName => {
            const perm = permissions.find(p => p.permission_name === permName);
            return (
              <li key={permName} className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  perm?.status === 'granted' ? 'bg-green-500' : 
                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                )} />
                <span className="text-xs truncate">{permName}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Entra ID / Security */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Entra ID / Security</p>
        <ul className="text-sm space-y-1">
          {ENTRA_ID_PERMISSIONS.map(permName => {
            const perm = permissions.find(p => p.permission_name === permName);
            return (
              <li key={permName} className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  perm?.status === 'granted' ? 'bg-green-500' : 
                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                )} />
                <span className="text-xs truncate">{permName}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Exchange Online */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Exchange Online</p>
        <ul className="text-sm space-y-1">
          {EXCHANGE_PERMISSIONS.map(permName => {
            const perm = permissions.find(p => p.permission_name === permName);
            return (
              <li key={permName} className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  perm?.status === 'granted' ? 'bg-green-500' : 
                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                )} />
                <span className="text-xs truncate">{permName}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Certificate Upload */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Upload de Certificados</p>
        <ul className="text-sm space-y-1">
          {CERTIFICATE_PERMISSIONS.map(permName => {
            const perm = permissions.find(p => p.permission_name === permName);
            return (
              <li key={permName} className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  perm?.status === 'granted' ? 'bg-green-500' : 
                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                )} />
                <span className="text-xs truncate">{permName}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  </div>
)}
```

---

## Resultado Visual

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Permissões (12/14)                                                          [▲]    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Permissões do Microsoft Graph                                                        │
│                                                                                      │
│ Obrigatórias (Core)          Entra ID / Security       Exchange Online              │
│ ● User.Read.All              ● Group.Read.All          ● MailboxSettings.Read       │
│ ● Directory.Read.All         ● Application.Read.All    ● Mail.Read                  │
│ ● Organization.Read.All      ● Policy.Read.All                                       │
│ ● Domain.Read.All            ● Reports.Read.All        Upload de Certificados       │
│ ● RoleManagement.ReadWrite   ● RoleManagement.Read     ● Application.ReadWrite.All  │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Comportamento

- **Verde** (●): Permissão concedida
- **Amarelo** (●): Permissão pendente (não validada ou não presente)
- **Vermelho** (●): Permissão negada/erro

As permissões são listadas por categoria mesmo que não existam no banco - assim o usuário sabe exatamente quais são necessárias em cada módulo.

---

## Benefícios

1. **Consistência visual** entre Settings e Tenant cards
2. **Clareza** sobre quais permissões são necessárias para cada funcionalidade
3. **Facilidade** para identificar permissões faltantes por módulo

