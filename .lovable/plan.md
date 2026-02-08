
# Plano: Igualar Permissões Exibidas com Azure e Reorganizar por Produto

## Mapeamento De → Para (Azure vs Interface)

### Permissões no Azure (14 total conforme imagem)
| Permissão Azure | Exibindo Atualmente? | Categoria Proposta |
|-----------------|----------------------|-------------------|
| User.Read.All | ✅ Sim | Entra ID |
| Directory.Read.All | ✅ Sim | Entra ID |
| Group.Read.All | ✅ Sim | Entra ID |
| Application.Read.All | ✅ Sim | Entra ID |
| AuditLog.Read.All | ✅ Sim | Entra ID |
| Organization.Read.All | ❌ Não | Entra ID |
| Policy.Read.All | ❌ Não | Entra ID |
| RoleManagement.ReadWrite.Directory | ✅ Sim | Exchange Online |
| MailboxSettings.Read | ✅ Sim | Exchange Online |
| Mail.Read | ✅ Sim | Exchange Online |
| Application.ReadWrite.OwnedBy | ❌ Não | Certificados |
| Application.ReadWrite.All | ❌ Não | Certificados |
| Reports.Read.All | ❌ Não | Outros |
| User.Read | ❌ Não | Básica (login) |

### Estrutura Proposta (5 colunas)

```text
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ Permissões (X/Y)                                                                      [▼] │
├───────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                           │
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌────────┐│
│ │ Entra ID        │ │ Exchange Online │ │ SharePoint      │ │ Certificados    │ │ Outros ││
│ │                 │ │                 │ │                 │ │                 │ │        ││
│ │ ● User.Read.All │ │ ● MailboxSett...│ │ ● Sites.Read... │ │ ● Application...│ │ ● User ││
│ │ ● Directory...  │ │ ● Mail.Read     │ │ (em breve)      │ │   ReadWrite.All │ │   .Read││
│ │ ● Group.Read...│ │ ● RoleManage... │ │                 │ │                 │ │ ● Repo ││
│ │ ● Application..│ │                 │ │                 │ │                 │ │   rts..││
│ │ ● AuditLog...  │ │                 │ │                 │ │                 │ │        ││
│ │ ● Organization.│ │                 │ │                 │ │                 │ │        ││
│ │ ● Policy.Read..│ │                 │ │                 │ │                 │ │        ││
│ └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘ └────────┘│
│                                                                                           │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

## Alterações

### Arquivo: src/components/m365/TenantStatusCard.tsx

#### Nova Estrutura de Categorias (linhas 42-48)

**Antes:**
```typescript
const PERMISSION_CATEGORIES = {
  'Entra ID': ['User.Read.All', 'Directory.Read.All', 'Group.Read.All', 'Application.Read.All', 'AuditLog.Read.All'],
  'Exchange Online': ['MailboxSettings.Read', 'Mail.Read'],
  'Roles & Admin': ['RoleManagement.ReadWrite.Directory'],
};
```

**Depois:**
```typescript
const PERMISSION_CATEGORIES = {
  'Entra ID': [
    'User.Read.All',
    'Directory.Read.All',
    'Group.Read.All',
    'Application.Read.All',
    'AuditLog.Read.All',
    'Organization.Read.All',
    'Policy.Read.All',
  ],
  'Exchange Online': [
    'MailboxSettings.Read',
    'Mail.Read',
    'RoleManagement.ReadWrite.Directory',
  ],
  'SharePoint': [
    'Sites.Read.All',
  ],
  'Certificados': [
    'Application.ReadWrite.All',
  ],
  'Outros': [
    'User.Read',
    'Reports.Read.All',
  ],
};
```

#### Atualizar Grid para 5 Colunas (linha 320)

**Antes:**
```tsx
<div className="grid gap-4 md:grid-cols-3">
```

**Depois:**
```tsx
<div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
```

## Resumo das Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Total de permissões | 8 | 14 |
| Colunas | 3 | 5 |
| Permissões Exchange | 2 | 3 (inclui RoleManagement) |
| SharePoint | Não existia | 1 (Sites.Read.All - placeholder) |
| Certificados | Não existia | 1 (Application.ReadWrite.All) |

## Sobre o Exchange Administrator Role

A permissão "Exchange Administrator Role" que foi removida é uma **Directory Role** (não uma Graph Permission). Ela é atribuída no Azure AD como um role, não como uma permissão de API.

Entretanto, a permissão `RoleManagement.ReadWrite.Directory` é necessária para verificar/atribuir essa role. Por isso, ela foi movida para a coluna "Exchange Online" - pois é usada para integrar com Exchange via PowerShell.

## Sobre SharePoint

O SharePoint atualmente usa os endpoints da Graph API sem permissões específicas declaradas:
- `/sites` - para listar sites (requer Sites.Read.All)
- `/drives` - para verificar OneDrive

A edge function `m365-check-sharepoint` já existe, mas não há validação de permissão específica. Adicionar `Sites.Read.All` como placeholder ajuda a preparar para quando implementarmos a conexão PowerShell similar ao Exchange.

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/m365/TenantStatusCard.tsx` | Atualizar PERMISSION_CATEGORIES e grid layout |

## Resultado Final

| Coluna | Permissões | Quantidade |
|--------|------------|------------|
| Entra ID | User.Read.All, Directory.Read.All, Group.Read.All, Application.Read.All, AuditLog.Read.All, Organization.Read.All, Policy.Read.All | 7 |
| Exchange Online | MailboxSettings.Read, Mail.Read, RoleManagement.ReadWrite.Directory | 3 |
| SharePoint | Sites.Read.All | 1 |
| Certificados | Application.ReadWrite.All | 1 |
| Outros | User.Read, Reports.Read.All | 2 |
| **Total** | | **14** |
