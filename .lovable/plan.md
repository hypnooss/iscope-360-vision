

# Padronização Completa do Espaçamento

## Problema Identificado

Duas páginas dentro do `AppLayout` ainda não seguem o padrão `p-6 lg:p-8 space-y-6`:

1. **Configurações** (`/settings`) - usa `p-6 space-y-6`
2. **Execuções de Tarefas** (`/scope-firewall/task-executions`) - usa `p-6 space-y-6`

## Alterações Necessárias

| Arquivo | Linha | Atual | Novo |
|---------|-------|-------|------|
| `src/pages/admin/SettingsPage.tsx` | 262 | `p-6 space-y-6` | `p-6 lg:p-8 space-y-6` |
| `src/pages/firewall/TaskExecutionsPage.tsx` | 209 | `p-6 space-y-6` | `p-6 lg:p-8 space-y-6` |

## Resultado Final

Todas as páginas que usam `AppLayout` terão o espaçamento padronizado:
- **24px** de padding em telas normais (`p-6`)
- **32px** de padding em telas grandes (`lg:p-8`)
- **24px** de espaçamento vertical entre elementos (`space-y-6`)

### Páginas Conformes (não requerem alteração)
- AdministratorsPage ✓
- AgentsPage ✓
- ClientsPage ✓
- DashboardPage ✓
- FirewallAnalysis ✓
- GeneralDashboardPage ✓
- ReportsPage ✓
- UsersPage ✓
- CollectionsPage ✓
- TasksPage ✓
- FirewallDashboardPage ✓
- FirewallListPage ✓
- FirewallReportsPage ✓
- EntraIdAnalysisPage ✓
- EntraIdAuditLogsPage ✓
- EntraIdPage ✓
- M365DashboardPage ✓
- TenantConnectionPage ✓

