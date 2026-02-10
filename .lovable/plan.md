
# Ajustes no modulo CVEs Microsoft 365

## 1. Mover menu CVEs para abaixo de Tenants

**Arquivo:** `src/components/layout/AppLayout.tsx`

Reordenar os itens do menu M365 de:
```
Tenants, Entra ID, Exchange Online, CVEs, Execucoes, Relatorios
```
Para:
```
Tenants, CVEs, Entra ID, Exchange Online, Execucoes, Relatorios
```

## 2. Espacamento padrao na pagina

**Arquivo:** `src/pages/m365/M365CVEsPage.tsx`

Adicionar o componente `PageBreadcrumb` no topo da pagina (igual as outras paginas M365 como ExchangeOnlinePage) para manter o padrao visual.

## 3. Focar nos produtos Office 365 (cloud)

**Arquivo:** `supabase/functions/m365-cves/index.ts`

Atualizar o mapeamento de produtos para refletir os servicos cloud do Office 365:
- "Exchange Server" passa a ser mapeado como **"Exchange Online"**
- "SharePoint" passa a ser mapeado como **"SharePoint Online"**
- Remover produtos on-premises puros (ex: versoes especificas de Exchange Server que nao se aplicam ao 365)

Os patterns de busca na MSRC continuam os mesmos (a API nao distingue on-prem vs online no product tree), mas o label exibido sera ajustado para o contexto cloud.

**Arquivo:** `src/pages/m365/M365CVEsPage.tsx`

Atualizar a lista `ALL_PRODUCTS` para usar os nomes cloud:
- "Exchange Server" -> "Exchange Online"
- "SharePoint" -> "SharePoint Online"

### Detalhes tecnicos

**AppLayout.tsx** (linha 131): Mover a entrada CVEs da posicao 4 para posicao 2 no array `items`.

**m365-cves/index.ts** (linhas 193-194): Alterar os nomes simplificados:
```
'exchange' -> 'Exchange Online'  (era 'Exchange Server')
'sharepoint' -> 'SharePoint Online'  (era 'SharePoint')
```

**M365CVEsPage.tsx** (linhas 15-16): Atualizar os nomes no array de filtros para coincidir com os novos labels.

Apos as alteracoes, reimplantar a edge function `m365-cves`.
