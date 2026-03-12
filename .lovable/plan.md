

## Renomear "Teams Analyzer" → "Colaboração Analyzer" + Adicionar Storage SharePoint

### 1. Renomear referências de UI (sem renomear arquivos/componentes internos)

**Arquivos afetados:**

- **`src/pages/m365/TeamsAnalyzerPage.tsx`**:
  - Breadcrumb: "Teams Analyzer" → "Colaboração Analyzer"
  - H1: "Teams Analyzer" → "Colaboração Analyzer"
  - Descrição: manter referência a Teams + SharePoint
  - Empty state: "Nenhuma análise do Teams" → "Nenhuma análise de Colaboração"
  - ScheduleDialog title: "Agendamento do Teams Analyzer" → "Agendamento do Colaboração Analyzer"
  - Alert: "análise do Teams" → "análise de Colaboração"

- **`src/components/layout/AppLayout.tsx`** (linha 143):
  - Menu label: "Teams Analyzer" → "Colaboração Analyzer"

### 2. Adicionar dados de storage SharePoint

**Edge Function `collaboration-dashboard/index.ts`:**
- Usar o relatório `getSharePointSiteUsageStorage(period='D7')` da Graph API para obter `storageUsedInBytes` e `storageAllocatedInBytes` do tenant
- Alternativamente, usar o endpoint `/sites/{siteId}/drive` por site (mas é lento para muitos sites)
- Melhor abordagem: usar `getSharePointSiteUsageDetail(period='D30')` que já é chamado — ele retorna `Storage Used (Byte)` e `Storage Allocated (Byte)` por site. Basta somar os valores na iteração existente.
- Adicionar ao resultado: `sharepoint.storageUsedGB`, `sharepoint.storageAllocatedGB`

**Hook `useCollaborationDashboard.ts`:**
- Expandir interface `CollaborationDashboardData.sharepoint` com `storageUsedGB` e `storageAllocatedGB`

**Stats Cards `TeamsAnalyzerStatsCards.tsx`:**
- Adicionar 5º card (ou substituir um) com ícone `HardDrive` mostrando storage usado/total (ex: "12.3 / 25.0 GB") com barra de progresso

### 3. Resumo das mudanças

| Arquivo | Mudança |
|---------|---------|
| `TeamsAnalyzerPage.tsx` | Textos "Teams Analyzer" → "Colaboração Analyzer" |
| `AppLayout.tsx` | Label do menu lateral |
| `collaboration-dashboard/index.ts` | Extrair `storageUsed` e `storageAllocated` do relatório SPO já existente |
| `useCollaborationDashboard.ts` | Adicionar `storageUsedGB`, `storageAllocatedGB` na interface |
| `TeamsAnalyzerStatsCards.tsx` | Novo card de storage com barra de progresso |

