

## Plano: Acesso direto ao Compliance (como o Analyzer)

### Resumo

Hoje, clicar em "Compliance" no menu leva a uma tela intermediária com tabela de snapshots. O objetivo é eliminar essa tela intermediária e levar o usuário diretamente ao relatório de compliance, com seletores no topo (Workspace para super roles + Firewall/Domínio/Tenant).

### Situação atual por módulo

| Módulo | Menu "Compliance" aponta para | Comportamento |
|--------|-------------------------------|---------------|
| Firewall | `/scope-firewall/reports` (FirewallReportsPage) | Tabela com lista de firewalls e snapshots → clica "Visualizar" → vai para `/scope-firewall/firewalls/:id/analysis` (FirewallAnalysis) |
| Domínio Externo | `/scope-external-domain/reports` (ExternalDomainReportsPage) | Tabela com lista de domínios e snapshots → clica "Visualizar" → vai para `/scope-external-domain/domains/:id/report/:analysisId` (ExternalDomainAnalysisReportPage) |
| M365 | `/scope-m365/reports` (M365ReportsPage) | Tabela com lista de tenants e snapshots → clica "Visualizar" → vai para `/scope-m365/posture/report/:reportId` (M365PostureReportPage) |

**Nota:** O M365 já possui a tela `/scope-m365/posture` (M365PosturePage) que funciona exatamente como o padrão desejado — com TenantSelector embutido e carregamento direto dos dados. Porém no menu, "Relatórios" aponta para a listagem.

### Mudanças propostas

#### 1. Firewall Compliance — Nova página direta
Criar uma nova página `src/pages/firewall/FirewallCompliancePage.tsx` que:
- Tem seletor de Workspace (para super_admin/super_suporte) — usando `useWorkspaceSelector`
- Tem seletor de Firewall (filtrável por workspace) — usando `useFirewallSelector`
- Ao selecionar um firewall, carrega automaticamente o **último** `analysis_history` desse firewall e renderiza o relatório de compliance (reutilizando o componente `Dashboard` já usado em `FirewallAnalysis.tsx`)
- Tem seletor de data/snapshot para navegar entre análises anteriores
- Mantém as ações existentes (exportar PDF, reanalisar, etc.)

#### 2. External Domain Compliance — Nova página direta
Criar uma nova página `src/pages/external-domain/ExternalDomainCompliancePage.tsx` que:
- Tem seletor de Workspace (para super_admin/super_suporte)
- Tem seletor de Domínio (filtrável por workspace) — novo hook `useDomainSelector` similar ao `useFirewallSelector`
- Ao selecionar um domínio, carrega automaticamente o **último** `external_domain_analysis_history` (source='agent') e renderiza o relatório
- Tem seletor de data/snapshot
- Reutiliza toda a lógica de normalização e renderização do `ExternalDomainAnalysisReportPage`

#### 3. M365 — Redirecionar para página existente
O M365 já possui `/scope-m365/posture` que funciona exatamente como desejado. Basta:
- Alterar o menu de "Relatórios" (`/scope-m365/reports`) para apontar para `/scope-m365/posture`
- Ou adicionar um item "Compliance" no menu apontando para `/scope-m365/posture`

#### 4. Navegação (AppLayout.tsx)
Atualizar os links do menu:
- **Firewall**: `Compliance` → `/scope-firewall/compliance` (nova página)
- **Domínio Externo**: `Compliance` → `/scope-external-domain/compliance` (nova página)
- **M365**: Manter ou adicionar `Compliance` → `/scope-m365/posture` (já existente)

#### 5. Rotas (App.tsx)
- Adicionar rota `/scope-firewall/compliance` → `FirewallCompliancePage`
- Adicionar rota `/scope-external-domain/compliance` → `ExternalDomainCompliancePage`
- Manter rotas antigas (`/scope-firewall/reports`, `/scope-external-domain/reports`, etc.) funcionando para backward compatibility
- As rotas dos relatórios individuais (`/scope-firewall/firewalls/:id/analysis`, `/scope-external-domain/domains/:id/report/:analysisId`) continuam existindo

#### 6. Hook: `useDomainSelector`
Criar `src/hooks/useDomainSelector.ts` seguindo o padrão do `useFirewallSelector` para persistir a seleção do domínio.

### Detalhes técnicos

**Padrão de seletores (baseado no AnalyzerDashboardPage):**
```text
┌──────────────────────────────────────────────────┐
│  [Workspace ▼]  [Firewall/Domínio ▼]  [Data ▼]  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │         Relatório de Compliance             │  │
│  │         (Score, Categorias, Checks)         │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Seletor de Data/Snapshot:** Um dropdown que lista as últimas N análises do firewall/domínio selecionado, mostrando data e score. O mais recente é selecionado por padrão.

**Arquivos novos:**
- `src/pages/firewall/FirewallCompliancePage.tsx`
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx`
- `src/hooks/useDomainSelector.ts`

**Arquivos editados:**
- `src/components/layout/AppLayout.tsx` — links do menu
- `src/App.tsx` — novas rotas

As páginas de listagem antigas (`FirewallReportsPage`, `ExternalDomainReportsPage`, `M365ReportsPage`) continuam existindo e acessíveis, mas não serão mais o ponto de entrada principal do menu.

