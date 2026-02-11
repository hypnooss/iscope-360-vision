

# Ajustes Visuais nos Cards do Dashboard

## Problemas Atuais

1. **Sparkline**: Ocupa largura total, separado da barra de progresso. Deveria estar "encaixado" logo acima da barra, com o valor "80/100" ao lado direito, ambos na mesma coluna visual.
2. **Badges de conformidade**: Alinhados a esquerda e comprimidos. Precisam ser distribuidos uniformemente.
3. **CVEs ausentes nos cards Firewall e M365**: O hook `useTopCVEs` tenta extrair CVEs individuais do `report_data`, mas esse campo contem apenas checks de conformidade, nao CVEs. CVEs individuais nao existem no banco -- apenas **contagens por severidade** na tabela `cve_severity_cache`, que ja sao carregadas em `health.cveSeverities`. A solucao e exibir as contagens de CVE por severidade (igual ao bloco de conformidade) em vez de CVEs individuais.

## Mudancas

### 1. Sparkline encaixado acima da barra (`GeneralDashboardPage.tsx`)

Reorganizar a secao de score para ficar visualmente "encaixado":

```text
   ▐▐  ▐▐  ▐▐  ▐▐  ▐▐  ▐▐  ▐▐  ▐▐  ▐▐  ▐▐  ▐▐  ▐▐
  SCORE ████████████████████████████████████  81 /100
```

- Sparkline fica na linha de cima, sem gap (margin-bottom: 0)
- Abaixo, na mesma linha horizontal: label "SCORE", barra `Progress` (`flex-1`), e valor "81/100"
- Remover o `space-y-2` entre sparkline e barra, usar `space-y-0` ou `gap-0`

### 2. Badges de conformidade distribuidos (`GeneralDashboardPage.tsx`)

- Trocar `flex gap-2` no `SeverityBadgeRow` por `grid grid-cols-4 gap-2`
- Mostrar todos os 4 badges sempre (com valor 0 em opacidade reduzida) para manter distribuicao uniforme

### 3. CVEs como contagens por severidade (`GeneralDashboardPage.tsx`)

Ja temos `health.cveSeverities` com `{ critical, high, medium, low }`. Em vez de mostrar CVEs individuais (que nao existem no DB), exibir um bloco identico ao de conformidade:

```text
  ALERTAS DE CVE
  [3 Critico]  [11 Alto]  [14 Medio]  [9 Baixo]
```

- Remover a importacao e uso de `useTopCVEs` e `CveAlertRow`
- Reutilizar `SeverityBadgeRow` passando `health.cveSeverities`
- Remover prop `topCves` do `ModuleHealthCard`

### 4. Limpar `useTopCVEs.ts`

Este hook pode ser removido pois os dados de CVE ja vem do `useDashboardStats` via `cveSeverities`.

### 5. Sparkline sem opacity (`ScoreSparkline.tsx`)

- Remover `opacity={0.7}` para barras mais solidas

## Arquivos

| Arquivo | Alteracao |
|---|---|
| `src/pages/GeneralDashboardPage.tsx` | Sparkline encaixado; badges grid-cols-4; CVEs como contagens; remover useTopCVEs |
| `src/components/dashboard/ScoreSparkline.tsx` | Remover opacity das barras |
| `src/hooks/useTopCVEs.ts` | Remover (nao mais necessario) |

