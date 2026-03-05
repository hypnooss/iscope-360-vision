

## Plano: Renomear KPI + Filtro por Clique nos Cards

### Alterações

**1. Renomear label** (`AnalyzerKPIRow.tsx`)
- "Viagem Impossível" → "Login Geo. Anômalo"

**2. Adicionar filtro por clique nos KPI cards**

Cada KPI card mapeia para um subconjunto de insights (por categoria ou nome). Ao clicar num card, o dashboard filtra os incidentes exibidos nas tabs para mostrar apenas os relacionados.

**Mecânica:**
- Adicionar um `kpiKey` string a cada KPI (ex: `'highRiskSignIns'`, `'impossibleTravel'`, etc.)
- `AnalyzerKPIRow` recebe um callback `onFilter(kpiKey: string | null)` e um `activeFilter: string | null`
- Cards ficam clicáveis com cursor pointer e borda highlight quando ativos; clicar no mesmo card novamente limpa o filtro
- Na page, novo estado `const [kpiFilter, setKpiFilter] = useState<string | null>(null)`
- Mapeamento de `kpiKey` → filtro de insights:

| kpiKey | Filtra insights por |
|---|---|
| `highRiskSignIns` | `category === 'security_risk'` e nome contém "risco" ou "risk" |
| `mfaFailures` | `category === 'security_risk'` e nome contém "mfa" |
| `impossibleTravel` | `category === 'security_risk'` e nome contém "impossível" ou "travel" ou "geo" |
| `correlatedAlerts` | `category === 'account_compromise'` |
| `suspiciousLogins` | `category === 'account_compromise'` e nome contém "login" ou "suspeito" |
| `anomalousUsers` | `category === 'behavioral_baseline'` |

- Quando `kpiFilter` está ativo, os arrays `criticalIncidents`, `highIncidents`, `mediumIncidents` e `anomalyInsights` são filtrados antes de renderizar
- Badge visual "Filtro ativo" aparece acima das tabs com botão "Limpar"

**Arquivos impactados:**
- `src/components/m365/analyzer/AnalyzerKPIRow.tsx` — renomear label, adicionar `onFilter`/`activeFilter` props, cards clicáveis
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` — estado de filtro, lógica de filtragem, badge de filtro ativo, passar props ao KPIRow

