

# Corrigir Painel Lateral e Pagina de Servicos Expostos

## Problema 1: Painel lateral mostra todos os achados da categoria

Quando voce clica em "nginx * -- 5 vulnerabilidades" na lista de Servicos Expostos, o codigo executa `setSheetCategory(f.category)`, que abre o painel filtrando por **categoria** (ex: "vulnerabilities"). Isso mostra TODOS os achados de vulnerabilidade (nginx, M365, openssh, etc.) em vez de mostrar apenas o item clicado.

## Problema 2: Pagina "Servicos Expostos" nao mostra todos os achados

A pagina AllFindingsPage usa a funcao `buildAssetsSimple` que define `cves: []` para todos os ativos (linha 69). Sem CVEs associados aos ativos, o motor `generateFindings` nao gera achados de vulnerabilidades. O dashboard principal usa `buildAssets` que faz o matching correto de CVEs. Por isso a pagina so mostra achados de servicos de risco, seguranca web, certificados e tecnologias obsoletas -- faltam todas as vulnerabilidades.

## Solucao

### 1. Painel lateral filtra pelo achado especifico

**Arquivo: `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`**

- Adicionar estado `sheetFindingId` para armazenar o ID do achado clicado
- Quando `sheetFindingId` esta definido, o painel mostra apenas aquele achado especifico
- Alterar `onFindingClick` para definir `sheetFindingId` em vez de `sheetCategory`
- Atualizar `sheetTitle` e `sheetOpen` para considerar o novo estado

### 2. Pagina AllFindingsPage usa buildAssets com CVE matching

**Arquivo: `src/pages/external-domain/AllFindingsPage.tsx`**

- Substituir `buildAssetsSimple` pela logica completa de `buildAssets` que inclui `matchCVEsToIP`
- Importar as funcoes auxiliares necessarias (`matchCVEsToIP`, `compareVersions`, `isVersionInRange`) ou reutilizar diretamente do V3 page
- Para evitar duplicacao de codigo, extrair a logica de matching de CVEs para um utilitario compartilhado (ou copiar as funcoes necessarias para AllFindingsPage)

