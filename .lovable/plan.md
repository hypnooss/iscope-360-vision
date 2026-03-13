

## Enriquecer Sheet "Usuários Ativos" com abas inline

### Dados disponíveis (do `EntraIdDashboardData.users`)
- `total`, `signInEnabled`, `disabled`, `guests`, `onPremSynced`
- Deriváveis: `cloudOnly = total - onPremSynced - guests`, `members = total - guests`

### Estrutura proposta

Usar o padrão de **Tabs inline** do Email Traffic com 3 abas:

**Aba "Visão Geral"** — Resumo do diretório
- Cards: Total de Usuários, Sign-in Habilitado, Desabilitados
- Barra de progresso horizontal: Ativos vs Desabilitados (% visual)
- Mini breakdown: Cloud-Only | Sincronizados | Convidados (3 cards em linha com ícones)

**Aba "Origem"** — De onde vêm os usuários
- Card destaque: Cloud-Only (total - onPremSynced - guests) com ícone Cloud
- Card destaque: Sincronizados On-Prem (onPremSynced) com ícone RefreshCw
- Barra proporcional mostrando a distribuição Cloud vs Synced
- Percentuais calculados

**Aba "Externos"** — Usuários convidados
- Card destaque: Total de Convidados (guests)
- Card: % do Diretório
- Card: Membros Internos (total - guests)
- Barra proporcional Internos vs Externos

### Arquivo alterado
- `src/components/m365/entra-id/EntraIdCategorySheet.tsx` — substituir o case `active_users` por componente com Tabs inline seguindo o padrão do `ExchangeCategorySheet`

### Padrão visual (copiado do Email Traffic)
- `TabsList` com `justify-start`, `rounded-none`, `border-b`
- `TabsTrigger` com ícone + label + contagem entre parênteses
- `ScrollArea` dentro de cada `TabsContent`
- `Badge` de resumo no topo de cada aba
- Cards internos com `CardHeader` + `CardContent`

