
# Plano: Implementar Breadcrumbs Clicáveis em Todo o Sistema

## Resumo

Criar um componente de breadcrumb reutilizável e clicável que será exibido no topo de todas as páginas do sistema (exceto modais/dialogs). Os breadcrumbs permitirão navegação rápida entre níveis hierárquicos e terão um espaçamento maior em relação ao título da página.

## Análise da Situação Atual

Atualmente, algumas páginas (como EntraIdPage e EntraIdAnalysisPage) usam badges com setas para indicar a hierarquia de navegação, mas:
- Os elementos não são clicáveis
- O espaçamento entre o "mapa" e o título é pequeno
- Não há um padrão consistente - a maioria das páginas não tem breadcrumb

## Solução Proposta

### 1. Criar Componente PageBreadcrumb Reutilizável

Criar um novo componente que:
- Aceita um array de itens de breadcrumb (label + href)
- Usa os componentes Breadcrumb existentes do shadcn/ui
- Torna todos os níveis (exceto o atual) clicáveis com navegação via react-router-dom
- Aplica o espaçamento correto abaixo do breadcrumb

**Arquivo:** `src/components/layout/PageBreadcrumb.tsx`

```typescript
interface BreadcrumbItem {
  label: string;
  href?: string; // Se não tiver href, é a página atual
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
}
```

### 2. Atualizar Páginas para Usar o Componente

Páginas que precisam de breadcrumb (excluindo modais/dialogs):

**Módulo M365:**
- `M365DashboardPage.tsx` - Microsoft 365
- `EntraIdPage.tsx` - Microsoft 365 > Entra ID
- `EntraIdAnalysisPage.tsx` - Microsoft 365 > Entra ID > Análise de Segurança
- `EntraIdAuditLogsPage.tsx` - Microsoft 365 > Entra ID > Logs de Auditoria
- `TenantConnectionPage.tsx` - Microsoft 365 > Conexão com Tenant

**Módulo Firewall:**
- `FirewallListPage.tsx` - Firewall > Firewalls
- `FirewallReportsPage.tsx` - Firewall > Relatórios
- `FirewallDashboardPage.tsx` - Firewall > Dashboard (se existir navegação)

**Páginas Gerais:**
- `GeneralDashboardPage.tsx` - Dashboard Geral
- `ClientsPage.tsx` - Workspaces
- `UsersPage.tsx` - Usuários
- `AgentsPage.tsx` - Agents
- `AdministratorsPage.tsx` - Administradores

**Administração:**
- `SettingsPage.tsx` - Configurações

### 3. Estrutura Hierárquica dos Breadcrumbs

```text
Dashboard Geral
├── Workspaces
├── Usuários
├── Agents
├── Administradores
└── Configurações

Microsoft 365
├── Entra ID
│   ├── Análise de Segurança
│   └── Logs de Auditoria
├── Conexão com Tenant
├── SharePoint (futuro)
├── Exchange (futuro)
└── ...

Firewall
├── Firewalls
├── Relatórios
└── Dashboard
```

### Detalhes Técnicos

**Componente PageBreadcrumb:**

```typescript
// src/components/layout/PageBreadcrumb.tsx
import { Link } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

interface BreadcrumbItemType {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItemType[];
}

export function PageBreadcrumb({ items }: PageBreadcrumbProps) {
  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <Fragment key={item.label}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.href!}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

**Exemplo de Uso em EntraIdAnalysisPage:**

```typescript
<PageBreadcrumb
  items={[
    { label: 'Microsoft 365', href: '/scope-m365' },
    { label: 'Entra ID', href: '/scope-m365/entra-id' },
    { label: 'Análise de Segurança' }, // Último item, sem href
  ]}
/>

// Espaçamento maior antes do título
<h1 className="text-2xl font-bold text-foreground">Análise de Segurança do Entra ID</h1>
```

**Alteração de Espaçamento:**

Atualmente o header usa `mb-1` após os badges. Com o novo componente:
- O `PageBreadcrumb` terá `mb-4` (16px de espaçamento abaixo)
- O título `<h1>` permanece sem margin-top adicional

### Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/layout/PageBreadcrumb.tsx` | **Criar novo** |
| `src/pages/m365/M365DashboardPage.tsx` | Adicionar breadcrumb |
| `src/pages/m365/EntraIdPage.tsx` | Substituir badges por PageBreadcrumb |
| `src/pages/m365/EntraIdAnalysisPage.tsx` | Substituir badges por PageBreadcrumb |
| `src/pages/m365/EntraIdAuditLogsPage.tsx` | Adicionar breadcrumb |
| `src/pages/m365/TenantConnectionPage.tsx` | Substituir badge por PageBreadcrumb |
| `src/pages/firewall/FirewallListPage.tsx` | Adicionar breadcrumb |
| `src/pages/firewall/FirewallReportsPage.tsx` | Adicionar breadcrumb |
| `src/pages/firewall/FirewallDashboardPage.tsx` | Adicionar breadcrumb |
| `src/pages/GeneralDashboardPage.tsx` | Adicionar breadcrumb (nível raiz) |
| `src/pages/ClientsPage.tsx` | Adicionar breadcrumb |
| `src/pages/UsersPage.tsx` | Adicionar breadcrumb |
| `src/pages/AgentsPage.tsx` | Adicionar breadcrumb |
| `src/pages/AdministratorsPage.tsx` | Adicionar breadcrumb |
| `src/pages/admin/SettingsPage.tsx` | Adicionar breadcrumb |

### Páginas Excluídas (Modais/Dialogs)

As seguintes páginas/componentes NÃO receberão breadcrumbs:
- `InviteUserDialog`
- `AddFirewallDialog`
- `EditFirewallDialog`
- `TenantConnectionWizard`
- `TenantEditDialog`
- `AdminEditDialog`
- Qualquer outro componente Dialog/Modal

### Resultado Esperado

1. Todas as páginas principais terão um mapa de navegação consistente no topo
2. Cada nível do breadcrumb será clicável e navegará para a página correspondente
3. O espaçamento entre o breadcrumb e o título será maior (16px vs 4px atual)
4. A experiência de navegação será mais intuitiva e consistente em todo o sistema
