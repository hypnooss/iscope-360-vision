

# Plano: Adicionar Permissões RBAC (Directory Roles) para Exchange e SharePoint

## Contexto

Atualmente a interface exibe apenas **Graph API Permissions**. Porém, para funcionalidades avançadas via PowerShell, são necessárias **Directory Roles** (funções de diretório) do Azure AD:

- **Exchange Online**: Requer `Exchange Administrator` ou `Exchange Recipient Administrator`
- **SharePoint Online**: Requer `SharePoint Administrator`

Estas roles são diferentes das permissões de API e precisam ser exibidas separadamente.

## Alterações

### Arquivo: src/components/m365/TenantStatusCard.tsx

#### 1. Adicionar nova estrutura para Directory Roles

```typescript
// Após PERMISSION_CATEGORIES (linha 68)
const DIRECTORY_ROLES = {
  'Exchange Online': [
    'Exchange Administrator',
  ],
  'SharePoint': [
    'SharePoint Administrator',
  ],
};
```

#### 2. Atualizar a seção de permissões no JSX

Adicionar uma nova seção abaixo das "Permissões do Microsoft Graph" para exibir as "Roles do Diretório":

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ Permissões (X/Y)                                                        [▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Permissões do Microsoft Graph                                               │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ Entra ID │ │ Exchange │ │SharePoint│ │Certificad│ │ Outros   │           │
│ │ (7)      │ │ (3)      │ │ (1)      │ │ (1)      │ │ (2)      │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                             │
│ Roles do Diretório (RBAC)                                                   │
│ ┌─────────────────────────┐ ┌─────────────────────────┐                     │
│ │ Exchange Online         │ │ SharePoint              │                     │
│ │ ● Exchange Administrator│ │ ● SharePoint Administra.│                     │
│ └─────────────────────────┘ └─────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3. Código JSX da nova seção (após linha 356)

```tsx
{/* Directory Roles Section */}
<div className="pt-4 border-t border-border/50">
  <p className="text-xs text-muted-foreground mb-3">Roles do Diretório (RBAC)</p>
  <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
    {Object.entries(DIRECTORY_ROLES).map(([category, roles]) => (
      <div key={category} className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{category}</p>
        <ul className="text-sm space-y-1">
          {roles.map(roleName => {
            const perm = permissions.find(p => p.permission_name === roleName);
            return (
              <li key={roleName} className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  perm?.status === 'granted' ? 'bg-green-500' : 
                  perm?.status === 'denied' ? 'bg-red-500' : 'bg-amber-500'
                )} />
                <span className="text-xs truncate">{roleName}</span>
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </div>
</div>
```

#### 4. Atualizar contagem total de permissões

Incluir as Directory Roles na contagem total:

```typescript
const ALL_PERMISSIONS = [
  ...Object.values(PERMISSION_CATEGORIES).flat(),
  ...Object.values(DIRECTORY_ROLES).flat(),
];
// Total: 14 + 2 = 16 permissões
```

## Resumo

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Graph API Permissions | 14 | 14 |
| Directory Roles | 0 | 2 |
| **Total** | **14** | **16** |

| Categoria | Tipo | Permissões |
|-----------|------|------------|
| Exchange Online | Directory Role | Exchange Administrator |
| SharePoint | Directory Role | SharePoint Administrator |

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/m365/TenantStatusCard.tsx` | Adicionar DIRECTORY_ROLES e nova seção no JSX |

