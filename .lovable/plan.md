

## Mapa de Origens de Login no Entra ID Analyzer

### Contexto
Os sign-in logs da Graph API já são coletados pela edge function `entra-id-dashboard` (linha 150) e contêm dados de localização (`location.countryOrRegion`). Precisamos agregar esses dados por país e exibi-los num mapa igual ao do Firewall Analyzer.

### Alterações

**1. Edge Function `supabase/functions/entra-id-dashboard/index.ts`**
- Após agregar os sign-in logs (linhas 206-213), adicionar lógica para agrupar por `location.countryOrRegion`, separando logins com sucesso e logins com falha em dois rankings `TopCountry[]`
- Incluir os novos campos `loginCountriesSuccess` e `loginCountriesFailed` no resultado e no cache JSONB

**2. Hook `src/hooks/useEntraIdDashboard.ts`**
- Estender `EntraIdDashboardData` com:
  - `loginCountriesSuccess: { country: string; count: number }[]`
  - `loginCountriesFailed: { country: string; count: number }[]`
- Mapear os novos campos no `loadCache` e `mapResultToData`

**3. Novo componente `src/components/m365/entra-id/EntraIdLoginMap.tsx`**
- Reutiliza o `AttackMap` existente do Firewall, passando:
  - `authFailedCountries` ← `loginCountriesFailed`
  - `authSuccessCountries` ← `loginCountriesSuccess`
  - Sem `firewallLocation` (sem ponto central, apenas os marcadores por país)
  - Sem outbound (não se aplica)
- Wrapper com Card, título "Mapa de Origens de Login" e legenda simplificada (apenas Sucesso/Falha)
- Botão de fullscreen (reutilizando `AttackMapFullscreen` adaptado ou um componente próprio simplificado)

**4. Página `src/pages/m365/EntraIdAnalyzerPage.tsx`**
- Importar `EntraIdLoginMap`
- Inserir entre o `EntraIdAnalyzerCategoryGrid` (linha 239) e o `EntraIdSecurityInsightCards` (linha 243)
- Passar `dashboardData.loginCountriesSuccess` e `dashboardData.loginCountriesFailed`

### Dados no Mapa

| Camada | Cor | Fonte |
|---|---|---|
| Login com Sucesso | Verde (#22c55e) | signInLogs onde errorCode === 0 |
| Login com Falha | Vermelho (#dc2626) | signInLogs onde errorCode !== 0 |

O mapa não terá ponto central (firewall), apenas marcadores circulares nos países de origem. Sem projectiles animados (não há "destino" definido). Legenda simplificada com apenas 2 itens.

