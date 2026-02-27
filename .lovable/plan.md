

## Plano: Botão ⚙️ visível para todos + aviso de recomendação no modal

### Mudanças

#### 1. `src/components/schedule/ScheduleDialog.tsx`
- Adicionar prop opcional `recommendation?: string`
- Renderizar um `Alert` (info) logo abaixo do `DialogDescription` com o texto da recomendação quando fornecido
- Import `Alert, AlertDescription` de `@/components/ui/alert` e ícone `Info`

#### 2. Remover guard `isSuperRole` do botão ⚙️ em 5 páginas:

**Compliance (3 páginas):**
- `src/pages/firewall/FirewallCompliancePage.tsx` (linhas 303-313) — remover `{isSuperRole && (...)}`
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx` (linhas 509-519) — remover `{isSuperRole && (...)}`
- M365PosturePage.tsx — já sem guard, nada a fazer

**Analyzer (3 páginas):**
- `src/pages/firewall/AnalyzerDashboardPage.tsx` (linhas 530-540) — remover `{isSuperRole && (...)}`
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` (linhas 305-315) — remover `{isSuperRole && (...)}`
- `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` (linha 438) — remover `{isSuperRole && ...}`

#### 3. Passar `recommendation` nas chamadas do ScheduleDialog

**Compliance pages** (FirewallCompliancePage, ExternalDomainCompliancePage, M365PosturePage):
- `recommendation="A análise de compliance verifica a conformidade da configuração. Recomendamos agendar a execução 1 vez ao dia."`

**Analyzer pages** que usam o componente `ScheduleDialog` reutilizável: nenhuma usa atualmente (usam inline). Nas 3 Analyzer pages com dialogs inline (AnalyzerDashboardPage, M365AnalyzerDashboardPage, SurfaceAnalyzerV3Page), adicionar um `Alert` info com texto:
- `"A análise do Analyzer monitora eventos e métricas em tempo real. Recomendamos agendar a execução 1 vez por hora."`

### Arquivos editados (7)
- `src/components/schedule/ScheduleDialog.tsx`
- `src/pages/firewall/FirewallCompliancePage.tsx`
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx`
- `src/pages/firewall/AnalyzerDashboardPage.tsx`
- `src/pages/m365/M365AnalyzerDashboardPage.tsx`
- `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`

