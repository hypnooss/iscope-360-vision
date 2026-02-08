

# Plano: Corrigir Lista de Permissões nos Cards de Tenant Cliente

## Problema Identificado

O `TenantStatusCard.tsx` está usando uma lista de 13 permissões copiada do SettingsPage (tenant home), mas os **tenants clientes** só validam/gravam 8 permissões + 1 role no banco.

**Permissões no SettingsPage (Tenant Home - 13):**
- Organization.Read.All, Domain.Read.All, RoleManagement.ReadWrite.Directory, RoleManagement.Read.Directory, Application.ReadWrite.All (não existem nos clientes)

**Permissões realmente validadas nos tenants clientes (do `validate-m365-connection`):**
- User.Read.All
- Directory.Read.All
- Group.Read.All
- Application.Read.All
- AuditLog.Read.All
- RoleManagement.ReadWrite.Directory (quando validado)
- MailboxSettings.Read
- Mail.Read
- Exchange Administrator Role (role adicional)

---

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/m365/TenantStatusCard.tsx` | Atualizar listas de permissões para refletir apenas as validadas nos tenants clientes |

---

## Mudança Detalhada

### `TenantStatusCard.tsx`

**Substituir as constantes de permissões** (linhas 44-48) por:

```typescript
// Permission categories for tenant clients (based on validate-m365-connection)
// These are the permissions actually validated and stored for client tenants
const CORE_PERMISSIONS = ['User.Read.All', 'Directory.Read.All', 'Group.Read.All', 'Application.Read.All', 'AuditLog.Read.All'];
const EXCHANGE_PERMISSIONS = ['MailboxSettings.Read', 'Mail.Read'];
const ROLE_PERMISSIONS = ['RoleManagement.ReadWrite.Directory', 'Exchange Administrator Role'];
const ALL_PERMISSIONS = [...CORE_PERMISSIONS, ...EXCHANGE_PERMISSIONS, ...ROLE_PERMISSIONS];
```

**Atualizar o grid de exibição** (linhas 319-399) para 3 colunas:

```typescript
<div className="grid gap-4 md:grid-cols-3">
  {/* Core Permissions */}
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">Obrigatórias</p>
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

  {/* Roles & Advanced */}
  <div className="space-y-2">
    <p className="text-xs font-medium text-muted-foreground">Roles do Diretório</p>
    <ul className="text-sm space-y-1">
      {ROLE_PERMISSIONS.map(permName => {
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
```

---

## Resultado

| Antes | Depois |
|-------|--------|
| 8/13 permissões (13 listadas, 8 gravadas) | 8/9 ou 9/9 permissões (apenas as que existem) |

**Categorias atualizadas:**

| Categoria | Permissões |
|-----------|------------|
| **Obrigatórias** | User.Read.All, Directory.Read.All, Group.Read.All, Application.Read.All, AuditLog.Read.All |
| **Exchange Online** | MailboxSettings.Read, Mail.Read |
| **Roles do Diretório** | RoleManagement.ReadWrite.Directory, Exchange Administrator Role |

---

## Nota Técnica

As permissões `Organization.Read.All`, `Domain.Read.All`, `RoleManagement.Read.Directory`, e `Application.ReadWrite.All` são usadas apenas no **tenant home (MSP)** para validação da configuração global, não nos tenants clientes. Por isso foram removidas do card de tenant cliente.

