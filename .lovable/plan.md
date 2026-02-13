

# Remover seção "Vulnerabilidades Detectadas" do topo do Attack Surface Analyzer

## Objetivo

Remover o card "Vulnerabilidades Detectadas" que aparece no topo da pagina do Attack Surface Analyzer. As CVEs ja sao exibidas dentro do painel expandido de cada IP no inventario, tornando essa lista redundante.

## Alteracao

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

- **Linha 1074**: Remover a renderizacao do componente `<CVEAlertSection>`:
  ```
  {snapshot && <CVEAlertSection cves={snapshot.cve_matches} />}
  ```
- **Linhas 263-311**: Remover a funcao `CVEAlertSection` e o componente `SeverityBadge` (se usado apenas ali), ja que nao serao mais referenciados.

Impacto: apenas visual, sem efeito em dados ou logica de negocio.

