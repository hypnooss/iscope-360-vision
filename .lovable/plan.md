
# Surface Analyzer V3 — Layout Dashboard

## Objetivo
Criar `/scope-external-domain/analyzer-v3` com layout de **dashboard visual** em vez de listas verticais infinitas. Toda a logica de dados (hooks, `buildAssets`, `generateFindings`, CVE matching) sera reutilizada do V2 — apenas o layout muda.

## Estrutura da Pagina

```text
+------------------------------------------------------------------+
| HEADER + WORKSPACE SELECTOR + ACOES (scan, schedule)             |
+------------------------------------------------------------------+
| PROGRESS BAR (se scan rodando)                                   |
+------------------------------------------------------------------+
| 4 SEVERITY CARDS                                                 |
| [Critical: X]  [High: X]  [Medium: X]  [Low: X]                 |
+------------------------------------------------------------------+
|                                                                  |
| PANORAMA DE CATEGORIAS (grid 3x2)                                |
| +--Servicos Risco--+ +--Vulnerabilidades-+ +--Certificados-----+ |
| | barra segmentada | | barra segmentada  | | barra segmentada  | |
| | 2C 1H badges     | | 1C 3H badges      | | 1H 1M badges      | |
| +----- click ------+ +----- click -------+ +----- click -------+ |
| +--Seguranca Web---+ +--Tech Obsoletas---+ +--Cred. Vazadas----+ |
| | barra segmentada | | barra segmentada  | | X emails vazados  | |
| +----- click ------+ +----- click -------+ +----- click -------+ |
|                                                                  |
+------------------------------------------------------------------+
| DOIS PAINEIS LADO A LADO (lg:grid-cols-2)                        |
| +--ACHADOS PRIORITARIOS-----+ +--SAUDE DOS ATIVOS-------------+ |
| | 1. RDP (3389) Crit [bar]  | | server01 [3C 2H] vermelho     | |
| | 2. SMB (445) Crit  [bar]  | | mail.co  [1H 1M] laranja      | |
| | 3. OpenSSH 8.2 Crit [bar] | | web.co   [1M]    amarelo       | |
| | 4. Cert expirado High     | | db.co    [ok]    verde          | |
| |        [Ver todos ->]     | |                                | |
| +---------------------------+ +--------------------------------+ |
+------------------------------------------------------------------+
| RODAPE: ultimo scan em DD/MM/AAAA HH:MM                         |
+------------------------------------------------------------------+
```

Clicar em qualquer **categoria**, **finding** ou **ativo** abre um `Sheet` lateral com os detalhes (reutilizando `SurfaceFindingCard` e `SurfaceCategorySection` existentes).

## Componentes a Criar

### 1. `src/components/surface/SeverityCards.tsx`
- 4 cards em `grid-cols-2 md:grid-cols-4`
- Cada card: icone, numero grande, label (Critical/High/Medium/Low)
- Cores: vermelho, laranja, amarelo, azul
- Padrao identico ao Firewall Analyzer

### 2. `src/components/surface/CategoryOverviewGrid.tsx`
- Grid `grid-cols-2 lg:grid-cols-3`
- Cada card: icone da categoria + label + barra horizontal segmentada por severidade + badges de contagem
- `onClick` -> abre `CategoryDetailSheet`
- A categoria "Credenciais Vazadas" mostra contagem de emails vazados em vez de severidades

### 3. `src/components/surface/TopFindingsList.tsx`
- Card com lista de max 7 findings (Critical + High primeiro)
- Cada linha: ranking number, nome do finding, badge severidade, ativo afetado, barra horizontal proporcional
- Padrao do `IPListWidget` do Firewall Analyzer (numero de ranking + barra de progresso)
- Link "Ver todos" no rodape -> abre Sheet com lista completa

### 4. `src/components/surface/AssetHealthGrid.tsx`
- Card com grid `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` de mini-cards
- Cada mini-card: hostname, IP, borda colorida pela pior severidade, contadores compactos
- Verde = sem findings, amarelo = medium, laranja = high, vermelho = critical
- `onClick` -> abre Sheet com findings filtrados daquele ativo

### 5. `src/components/surface/CategoryDetailSheet.tsx`
- `Sheet` lateral (side="right", largura lg)
- Header: icone + nome da categoria + contadores
- Body: reutiliza `SurfaceFindingCard` para cada finding da categoria
- Tambem usado para mostrar findings de um ativo especifico

### 6. `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`
- Pagina principal do dashboard
- Reutiliza toda a logica de dados do V2 (hooks, buildAssets, generateFindings, CVE cache, progress, scan, schedule)
- Layout: Header -> Progress -> SeverityCards -> CategoryOverviewGrid -> TopFindings + AssetHealth lado a lado
- Estados para controlar Sheet aberto (categoria ou ativo)
- Dialogs de scan e schedule copiados do V2

## Rota

Adicionar em `App.tsx`:
```
const SurfaceAnalyzerV3Page = lazy(() => import("./pages/external-domain/SurfaceAnalyzerV3Page"));
<Route path="/scope-external-domain/analyzer-v3" element={<SurfaceAnalyzerV3Page />} />
```

## Arquivos Afetados

| Arquivo | Acao |
|---|---|
| `src/components/surface/SeverityCards.tsx` | Criar |
| `src/components/surface/CategoryOverviewGrid.tsx` | Criar |
| `src/components/surface/TopFindingsList.tsx` | Criar |
| `src/components/surface/AssetHealthGrid.tsx` | Criar |
| `src/components/surface/CategoryDetailSheet.tsx` | Criar |
| `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` | Criar |
| `src/App.tsx` | Adicionar rota e lazy import |

## Reutilizacao

- `SurfaceFindingCard` e `SurfaceCategorySection` existentes sao usados dentro dos Sheets
- Toda a logica de `buildAssets`, `generateFindings`, `calculateFindingsStats`, `CATEGORY_INFO` vem de `surfaceFindings.ts`
- Hooks de dados (`useLatestAttackSurfaceSnapshot`, `useAttackSurfaceScan`, etc) reutilizados
- Helper functions (`matchCVEsToIP`, `compareVersions`, etc) copiadas/importadas do V2
