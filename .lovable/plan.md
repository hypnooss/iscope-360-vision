

# Migrar Surface Analyzer V3 para rota de producao

## Resumo

Substituir a rota de teste `/scope-external-domain/analyzer-v3` pela rota de producao `/scope-external-domain/analyzer`, removendo as versoes anteriores (V1 e V2).

## Mudancas

### 1. `src/App.tsx` — Rotas

- Remover as 3 rotas antigas (analyzer V1, V2, V3)
- Criar 2 rotas novas:
  - `/scope-external-domain/analyzer` apontando para `SurfaceAnalyzerV3Page`
  - `/scope-external-domain/analyzer/findings` apontando para `AllFindingsPage`
- Remover os imports lazy de `AttackSurfaceAnalyzerPage` e `SurfaceAnalyzerV2Page`

### 2. `src/components/surface/TopFindingsList.tsx` — Link interno

- Atualizar navigate de `/scope-external-domain/analyzer-v3/findings` para `/scope-external-domain/analyzer/findings`

### 3. `src/pages/external-domain/AllFindingsPage.tsx` — Breadcrumb e botao voltar

- Breadcrumb: mudar label de `Analyzer (v3)` para `Analyzer` e href para `/scope-external-domain/analyzer`
- Botao voltar: atualizar navigate para `/scope-external-domain/analyzer`

### 4. `src/components/layout/AppLayout.tsx` — Nenhuma mudanca

O menu lateral ja aponta para `/scope-external-domain/analyzer`, entao nao precisa de alteracao.

## O que NAO muda

- Nenhum componente de UI do V3 e alterado (SurfaceAnalyzerV3Page, donut, findings, sheets)
- Nenhuma logica de dados ou hooks
- A sidebar ja aponta para a rota correta

## Arquivos que podem ser removidos (limpeza)

- `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` (V1 — nao mais referenciado)
- `src/pages/external-domain/SurfaceAnalyzerV2Page.tsx` (V2 — nao mais referenciado)

