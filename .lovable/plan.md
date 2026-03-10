

## Mailboxes Inativas: Separação por 30, 60 e 90 dias

### Situação atual
O backend (`exchange-dashboard`) só calcula `notLoggedIn30d` (último login < 30 dias). O relatório da Graph API (`getMailboxUsageDetail(period='D30')`) retorna o campo `Last Activity Date` com a data exata do último login, permitindo classificar em faixas de inatividade.

### Correções

**1. Backend: `supabase/functions/exchange-dashboard/index.ts`**

Adicionar contadores `notLoggedIn60d` e `notLoggedIn90d` (além do existente `notLoggedIn30d`), calculando com base no `Last Activity Date`:
- 30d: lastActivity < 30 dias atrás
- 60d: lastActivity < 60 dias atrás  
- 90d: lastActivity < 90 dias atrás

Incluir os 3 valores no objeto `mailboxes` do resultado.

**Nota**: O relatório `getMailboxUsageDetail(period='D30')` retorna **todas** as mailboxes com sua data de última atividade (não apenas as dos últimos 30 dias), então é possível classificar em 60d e 90d.

**2. Frontend - Interface de tipos: `src/hooks/useExchangeDashboard.ts`**

Adicionar `notLoggedIn60d` e `notLoggedIn90d` ao tipo `ExchangeDashboardData.mailboxes`.

**3. Frontend - Card principal: `src/components/m365/exchange/ExchangeAnalyzerCategoryGrid.tsx`**

No case `inactive_mailboxes`, alterar o `badgeLabel` para exibir as 3 faixas sumarizadas, ex: `"30d: 424 · 60d: 312 · 90d: 198"`.

**4. Frontend - Drill-down: `src/components/m365/exchange/ExchangeCategorySheet.tsx`**

No `renderMailboxContent` para `inactive_mailboxes`:
- Exibir 3 badges com as contagens por faixa (30d, 60d, 90d)
- Usar Tabs com 3 abas ("30 dias", "60 dias", "90 dias") para separar os rankings de mailboxes inativas por período

**5. Frontend - Componentes auxiliares que referenciam `notLoggedIn30d`**

Atualizar `ExchangeOverviewCards.tsx`, `MailboxHealthCard.tsx` e `EmailSecurityScoreCard.tsx` para refletir os novos campos (manter compatibilidade com `notLoggedIn30d` como valor principal).

