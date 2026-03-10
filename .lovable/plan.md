

## Criar "Entra ID Analyzer" — clone do Exchange Analyzer adaptado para identidade

### Visão Geral
Clonar a estrutura completa do Exchange Analyzer (`ExchangeAnalyzerPage`) e seus componentes, adaptando para dados de identidade do Entra ID. A página usará o mesmo snapshot do M365 Analyzer (`useLatestM365AnalyzerSnapshot`) filtrando categorias de identidade, e o hook `useEntraIdDashboard` para KPIs.

---

### Arquivos a criar

**1. `src/pages/m365/EntraIdAnalyzerPage.tsx`** (clone de `ExchangeAnalyzerPage`)
- Breadcrumb: `Microsoft 365 > Entra ID Analyzer`
- Header com seletores de Workspace/Tenant (mesmo padrão)
- Botão "Executar Análise" chamando `trigger-m365-analyzer` + `entra-id-dashboard`
- Linha de "Última coleta"
- KPIs via `EntraIdAnalyzerStatsCards` (dados do `useEntraIdDashboard`)
- Panorama por Categoria via `EntraIdAnalyzerCategoryGrid`
- Insights de Segurança via `EntraIdSecurityInsightCards` (filtro nas categorias de identidade do analyzer)
- Schedule Dialog para agendamento
- Categorias do analyzer filtradas: `security_risk`, `identity_access`, `conditional_access`, `account_compromise`, `operational_risks`, `audit_compliance`

**2. `src/components/m365/entra-id/EntraIdAnalyzerStatsCards.tsx`**
- 4 KPI cards: Total de Usuários, Cobertura MFA (%), Usuários em Risco, Admins Globais
- Dados vindos do `EntraIdDashboardData`

**3. `src/components/m365/entra-id/EntraIdAnalyzerCategoryGrid.tsx`**
- Grid de categorias operacionais do Entra ID (mesmo visual do Exchange):
  - Usuários Ativos, Cobertura MFA, Risco de Identidade, Logins com Falha, Administradores, Contas Desabilitadas, Convidados, Atividade de Senhas
- Cada card com barra de severidade e badges
- Click abre Sheet de detalhe

**4. `src/components/m365/entra-id/EntraIdCategorySheet.tsx`**
- Sheet lateral (50vw) com detalhes da categoria selecionada
- Rankings e listas detalhadas por categoria (usuários de risco, admins, etc.)

**5. `src/components/m365/entra-id/EntraIdSecurityInsightCards.tsx`**
- Clone do `ExchangeSecurityInsightCards` filtrando insights de identidade
- Cards com severidade, ocorrências, usuários afetados e drill-down em Sheet

---

### Arquivos a editar

**6. `src/components/layout/AppLayout.tsx`** (linha ~142)
- Adicionar item de menu: `{ label: 'Entra ID Analyzer', href: '/scope-m365/entra-id-analyzer', icon: Shield }`
- Posicionar logo abaixo de "Exchange Analyzer"

**7. `src/App.tsx`**
- Adicionar lazy import: `const EntraIdAnalyzerPage = lazy(() => import("./pages/m365/EntraIdAnalyzerPage"));`
- Adicionar rota: `<Route path="/scope-m365/entra-id-analyzer" element={<EntraIdAnalyzerPage />} />`

---

### Dados e Hooks

- **KPIs**: `useEntraIdDashboard` (users, mfa, risks, admins, loginActivity, passwordActivity)
- **Insights operacionais**: `useLatestM365AnalyzerSnapshot` filtrando categorias de identidade (`security_risk`, `identity_access`, `conditional_access`, `account_compromise`, `operational_risks`, `audit_compliance`)
- **Análise**: `trigger-m365-analyzer` (mesmo endpoint, já coleta dados de identidade) + `entra-id-dashboard` (refresh do cache)

### Categorias do Grid (mapeadas dos dados do `EntraIdDashboardData`)

| Categoria | Dados | Severidade |
|---|---|---|
| Usuários Ativos | users.signInEnabled / users.total | low-none |
| Cobertura MFA | mfa.enabled / mfa.total (%) | critical se <50%, high <70%, medium <85% |
| Risco de Identidade | risks.riskyUsers + risks.compromised | critical se >10, high >5, medium >0 |
| Logins com Falha | loginActivity.failed | high >100, medium >30 |
| Administradores | admins.total (globalAdmins) | high >5 GA, medium >3 |
| Contas Desabilitadas | users.disabled | medium >20%, low >0 |
| Convidados | users.guests | medium >50, low >0 |
| Atividade de Senhas | passwordActivity (resets+forcedChanges+selfService) | medium >20, low >0 |

