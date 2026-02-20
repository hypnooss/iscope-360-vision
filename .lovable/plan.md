

# Reestruturar Layout do Dashboard V3 + Pagina de Todos os Achados + Grafico Donut Duplo

## Resumo das Alteracoes

Tres mudancas principais no Surface Analyzer V3:

1. **"Ver todos os achados" abre uma pagina dedicada** (nao mais um Sheet lateral)
2. **"Saude dos Ativos" move para linha full-width** abaixo dos cards de achados
3. **Novo componente de grafico Donut duplo** ocupa o espaco ao lado de "Achados Prioritarios" — anel interno mostra distribuicao de severidade, anel externo mostra tecnologias/servicos detectados

## Layout Resultante

```text
+-----------------------------------------------------+
|  Stats Cards (4 colunas)                             |
+-----------------------------------------------------+
|  Panorama por Categoria (grid de cards)              |
+---------------------------+-------------------------+
|  Achados Prioritarios     |  Donut Duplo            |
|  (top critical+high)      |  (severidade + techs)   |
|  [Ver todos -> pagina]    |                         |
+---------------------------+-------------------------+
|  Saude dos Ativos (full-width, 2 colunas internas)  |
+-----------------------------------------------------+
```

## Detalhe Tecnico

### 1. Nova pagina: Todos os Achados

**Novo arquivo:** `src/pages/external-domain/AllFindingsPage.tsx`

- Rota: `/scope-external-domain/analyzer-v3/findings`
- Segue o padrao visual da aplicacao: `AppLayout`, `PageBreadcrumb`, titulo com botao de voltar (`ArrowLeft`), subtitulo, seletor de workspace para super roles
- Recebe o `clientId` via contexto (mesmo fluxo do V3 — busca `useClientId`, carrega snapshot, gera findings)
- Lista **todos** os findings (nao apenas critical/high), agrupados por severidade ou em lista unica ordenada
- Cada finding usa o componente `SurfaceFindingCard` ja existente

**Alteracao em `src/App.tsx`:** adicionar rota nova

**Alteracao em `src/components/surface/TopFindingsList.tsx`:**
- O botao "Ver todos os achados" passa a navegar para a nova rota via `useNavigate()` em vez de chamar `onViewAll`

**Alteracao em `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`:**
- Remover o state `sheetAllFindings` e a logica de abrir Sheet para "todos os achados" (o Sheet continua existindo para categorias individuais e ativos)

### 2. Mover "Saude dos Ativos" para full-width

**Alteracao em `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`:**

O grid `lg:grid-cols-2` atual contem `TopFindingsList` + `AssetHealthGrid` lado a lado. A nova estrutura:

```tsx
{/* Row: Achados Prioritarios + Donut Duplo */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <TopFindingsList ... />
  <SeverityTechDonut findings={findings} assets={assets} />
</div>

{/* Row: Saude dos Ativos (full-width) */}
<AssetHealthGrid assets={assets} findings={findings} onAssetClick={...} />
```

O `AssetHealthGrid` ja renderiza internamente em `grid-cols-1 sm:grid-cols-2`, entao ocupando a largura total fica muito melhor.

### 3. Novo componente: Grafico Donut Duplo

**Novo arquivo:** `src/components/surface/SeverityTechDonut.tsx`

Utiliza `recharts` (ja instalado) com `PieChart` e dois componentes `Pie` concentricos:

- **Anel interno (menor raio):** Distribuicao de severidade dos findings
  - Critical (vermelho), High (laranja), Medium (amarelo), Low (azul)
  - Dados: contagem de findings por severity
- **Anel externo (maior raio):** Top tecnologias/servicos detectados
  - Extraidos de `assets[].allTechs` (produto/versao) e `assets[].services`
  - Agrupa por nome de tecnologia com contagem de ativos onde aparece
  - Exibe as top 8-10 tecnologias, agrupando o restante em "Outros"
  - Cores distintas por tecnologia

O componente fica dentro de um `Card` com titulo "Visao Geral" e uma legenda compacta abaixo do grafico mostrando os itens de cada anel.

Props:
```tsx
interface SeverityTechDonutProps {
  findings: SurfaceFinding[];
  assets: ExposedAsset[];  // ou FindingsAsset[]
}
```

