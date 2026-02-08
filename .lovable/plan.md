
# Plano: Remover RBAC Card e Reorganizar Permissões por Produto

## Objetivo

1. **Remover** o card de Exchange Online RBAC e todo o código relacionado
2. **Reorganizar** a tabela de permissões agrupando por produto Microsoft

## Alterações

### Arquivo 1: src/components/m365/TenantStatusCard.tsx

#### 1.1 Remover imports e estados relacionados ao RBAC

**Linhas a remover:**
- Linha 42: `import { ExchangeRBACSetupCard } from './ExchangeRBACSetupCard';`
- Linha 91: `const [showExchangeRBAC, setShowExchangeRBAC] = useState(false);`

#### 1.2 Remover variáveis e efeitos do RBAC

**Linhas a remover:**
- Linhas 166-169: `const exchangeAdminRolePending = permissions.find(...)`
- Linhas 172-176: `useEffect` para auto-show do RBAC card

#### 1.3 Reorganizar categorias de permissões por produto

**Antes (3 colunas genéricas):**
```typescript
const CORE_PERMISSIONS = ['User.Read.All', 'Directory.Read.All', 'Group.Read.All', 'Application.Read.All', 'AuditLog.Read.All'];
const EXCHANGE_PERMISSIONS = ['MailboxSettings.Read', 'Mail.Read'];
const ROLE_PERMISSIONS = ['RoleManagement.ReadWrite.Directory', 'Exchange Administrator Role'];
```

**Depois (5 categorias por produto):**
```typescript
const PERMISSION_CATEGORIES = {
  'Entra ID': ['User.Read.All', 'Directory.Read.All', 'Group.Read.All', 'Application.Read.All', 'AuditLog.Read.All'],
  'Exchange Online': ['MailboxSettings.Read', 'Mail.Read'],
  'Roles & Admin': ['RoleManagement.ReadWrite.Directory'],
};
// Remover 'Exchange Administrator Role' da lista
```

#### 1.4 Atualizar o grid de permissões

**Antes (linhas 376-445):**
- 3 colunas: Obrigatórias, Exchange Online, Roles do Diretório
- Botão "Configurar" ao lado de Exchange Administrator Role
- ExchangeRBACSetupCard no final

**Depois:**
- 3 colunas: Entra ID, Exchange Online, Roles & Admin
- Remover "Exchange Administrator Role" completamente
- Remover o ExchangeRBACSetupCard

#### 1.5 Atualizar contagem de permissões

**Antes:**
```typescript
const ALL_PERMISSIONS = [...CORE_PERMISSIONS, ...EXCHANGE_PERMISSIONS, ...ROLE_PERMISSIONS];
// Total: 9 permissões
```

**Depois:**
```typescript
const ALL_PERMISSIONS = [
  ...PERMISSION_CATEGORIES['Entra ID'],
  ...PERMISSION_CATEGORIES['Exchange Online'],
  ...PERMISSION_CATEGORIES['Roles & Admin'],
];
// Total: 8 permissões (sem Exchange Administrator Role)
```

### Arquivo 2: Arquivos a remover (opcional, pode ser feito depois)

| Arquivo | Razão |
|---------|-------|
| `src/components/m365/ExchangeRBACSetupCard.tsx` | Componente não mais utilizado |
| `supabase/functions/setup-exchange-rbac/index.ts` | Edge function não mais necessária |

## Layout Atualizado da Seção de Permissões

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Permissões (8/8)                                               [▲/▼]   │
├─────────────────────────────────────────────────────────────────────────┤
│ Permissões do Microsoft Graph                                           │
│                                                                         │
│ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│ │ Entra ID        │  │ Exchange Online │  │ Roles & Admin   │          │
│ │                 │  │                 │  │                 │          │
│ │ ● User.Read.All │  │ ● MailboxSett.. │  │ ● RoleManagem.. │          │
│ │ ● Directory...  │  │ ● Mail.Read     │  │                 │          │
│ │ ● Group.Read..  │  │                 │  │                 │          │
│ │ ● Application.. │  │                 │  │                 │          │
│ │ ● AuditLog...   │  │                 │  │                 │          │
│ └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                         │
│ (SEM EXCHANGE RBAC CARD)                                               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Resumo de Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/components/m365/TenantStatusCard.tsx` | EDIT | Remover RBAC e reorganizar permissões |
| `src/components/m365/ExchangeRBACSetupCard.tsx` | DELETE (opcional) | Componente obsoleto |
| `supabase/functions/setup-exchange-rbac/index.ts` | DELETE (opcional) | Edge function obsoleta |

## Código Final da Seção de Permissões

```tsx
// Nova estrutura de permissões por produto
const PERMISSION_CATEGORIES = {
  'Entra ID': ['User.Read.All', 'Directory.Read.All', 'Group.Read.All', 'Application.Read.All', 'AuditLog.Read.All'],
  'Exchange Online': ['MailboxSettings.Read', 'Mail.Read'],
  'Roles & Admin': ['RoleManagement.ReadWrite.Directory'],
};

const ALL_PERMISSIONS = Object.values(PERMISSION_CATEGORIES).flat();

// No JSX (substituir linhas 376-463):
{showPermissions && (
  <div className="mt-3 space-y-4">
    <p className="text-xs text-muted-foreground">Permissões do Microsoft Graph</p>
    <div className="grid gap-4 md:grid-cols-3">
      {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => (
        <div key={category} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{category}</p>
          <ul className="text-sm space-y-1">
            {perms.map(permName => {
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
      ))}
    </div>
  </div>
)}
```

## Impacto

- **UI simplificada**: Remove complexidade desnecessária do card de RBAC
- **Organização clara**: Permissões agrupadas por produto Microsoft
- **Menos código**: Remove ~150 linhas de código não utilizado
- **Contagem atualizada**: 8 permissões ao invés de 9 (sem Exchange Administrator Role)
