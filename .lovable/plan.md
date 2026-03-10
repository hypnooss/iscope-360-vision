

## Remover submenu e página "Exchange Online"

### Alterações

**1. `src/components/layout/AppLayout.tsx`** (linha 146)
- Remover o item de menu `{ label: 'Exchange Online', href: '/scope-m365/exchange-online', icon: Mail }`.

**2. `src/App.tsx`**
- Remover o lazy import do `ExchangeOnlinePage` (linha 68).
- Remover a rota `/scope-m365/exchange-online` (linha 165).

**3. `src/pages/m365/ExchangeOnlinePage.tsx`**
- Deletar o arquivo (o conteúdo foi absorvido pelo Exchange Analyzer).

Os componentes de Exchange (`EmailSecurityScoreCard`, `ExchangeOverviewCards`, etc.) e o hook `useExchangeDashboard` continuam sendo usados pelo Exchange Analyzer, então serão mantidos.

