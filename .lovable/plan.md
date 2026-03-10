

## Criar "Teams Analyzer" — clone do Exchange Analyzer adaptado para Teams/Colaboração

### Arquivos a criar

**1. `src/pages/m365/TeamsAnalyzerPage.tsx`** (clone de `ExchangeAnalyzerPage`)
- Breadcrumb: `Microsoft 365 > Teams Analyzer`
- Mesma estrutura: seletores Workspace/Tenant, botão "Executar Análise" (chama `trigger-m365-analyzer` + `collaboration-dashboard`)
- KPIs via `TeamsAnalyzerStatsCards` (dados do `useCollaborationDashboard`)
- Panorama por Categoria via `TeamsAnalyzerCategoryGrid`
- Insights de Segurança via `TeamsSecurityInsightCards` (filtro em categorias de colaboração do analyzer)
- Categorias filtradas do analyzer: `teams_governance`, `sharepoint_exposure`, `guest_access`, `external_sharing`, `collaboration_risk`

**2. `src/components/m365/teams/TeamsAnalyzerStatsCards.tsx`**
- 4 KPI cards: Total Teams, Teams Públicas (% exposição), Convidados Externos, Compartilhamento Externo SPO
- Dados do `CollaborationDashboardData`

**3. `src/components/m365/teams/TeamsAnalyzerCategoryGrid.tsx`**
- Grid de categorias operacionais (mesmo visual do Exchange):
  - Teams Públicas, Teams Privadas, Convidados Externos, Canais Privados, Canais Compartilhados, Sites SharePoint, Compartilhamento Externo, Sites Inativos
- Cada card com barra de severidade e badges
- Click abre Sheet de detalhe

**4. `src/components/m365/teams/TeamsCategorySheet.tsx`**
- Sheet lateral (50vw) com detalhes da categoria selecionada

**5. `src/components/m365/teams/TeamsSecurityInsightCards.tsx`**
- Clone do `ExchangeSecurityInsightCards` filtrando insights de colaboração
- Ícone Teams no header do Sheet

### Arquivos a editar

**6. `src/components/layout/AppLayout.tsx`** (~linha 143)
- Adicionar: `{ label: 'Teams Analyzer', href: '/scope-m365/teams-analyzer', icon: Users }` abaixo de "Entra ID Analyzer"

**7. `src/App.tsx`**
- Lazy import + rota `/scope-m365/teams-analyzer`

### Categorias do Grid (mapeadas de `CollaborationDashboardData`)

| Categoria | Dados | Severidade |
|---|---|---|
| Teams Públicas | teams.public / teams.total | critical >50%, high >30%, medium >10% |
| Teams Privadas | teams.private | low-none (informativo) |
| Convidados Externos | teams.withGuests / teams.total | high >40%, medium >20%, low >0 |
| Canais Privados | teams.privateChannels | medium >50, low >0 |
| Canais Compartilhados | teams.sharedChannels | high >20, medium >5, low >0 |
| Sites SharePoint | sharepoint.totalSites | informativo |
| Compartilhamento Externo | sharepoint.externalSharingEnabled / totalSites | critical >50%, high >30%, medium >10% |
| Sites Inativos | sharepoint.inactiveSites / totalSites | high >40%, medium >20%, low >0 |

