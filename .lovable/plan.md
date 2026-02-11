

# Reestruturar Cards de Modulo no Dashboard

## O que muda

Os cards de modulo no Dashboard General passam de um layout centralizado (gauge no meio) para um layout horizontal:
- **Gauge a esquerda**
- **Badges de severidade a direita** (Critico, Alto, Medio, Baixo) com os totais de cada modulo/workspace
- **Remover** o elemento de CVEs do card Microsoft 365 e a propriedade `hideSeverities`

## Layout do Card (novo)

```text
+--------------------------------------------------+
| [icon] Titulo do Modulo                     [->]  |
|                                                   |
|  [ ScoreGauge ]    Critico:  2                    |
|  [   86 BOM  ]    Alto:     5                     |
|                    Medio:   12                    |
|                    Baixo:    3                    |
|                                                   |
|  Ultima analise: ha 6 dias                        |
+--------------------------------------------------+
```

As badges usam o padrao visual ja existente no projeto (cores de severidade: rose para critico, orange para alto, amber para medio, blue para baixo).

## Alteracoes Tecnicas

### 1. `src/pages/GeneralDashboardPage.tsx`

- **Remover** o bloco `extraInfo` que gera o elemento CVE para M365 (linhas 226-237)
- **Remover** a prop `hideSeverities` do `ModuleHealthCard`
- **Remover** a prop `extraInfo` do `ModuleHealthCard`
- **Remover** o import e uso de `useM365CVEs`
- **Reestruturar** o layout interno do `ModuleHealthCard`:
  - Trocar `flex-col items-center` por `flex-col` no container principal
  - A area central passa a ser `flex flex-row items-center gap-6`:
    - Esquerda: `ScoreGauge` (size sm)
    - Direita: grade vertical com 4 badges de severidade (critico, alto, medio, baixo), cada um mostrando icone + contagem + label
  - Se todas as severidades forem 0, exibir um indicador "Nenhum alerta" com icone de check

### 2. `src/config/moduleDashboardConfig.ts`

- Remover a propriedade `hideSeverities` da interface e do registro de `scope_m365`

### 3. `src/hooks/useDashboardStats.ts`

- **External Domain**: adicionar coleta de severidades a partir de `external_domain_analysis_history.report_data.summary` (mesmo padrao do firewall), para que os badges tenham dados reais

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/pages/GeneralDashboardPage.tsx` | Reestruturar layout do card, remover CVE e hideSeverities |
| `src/config/moduleDashboardConfig.ts` | Remover `hideSeverities` |
| `src/hooks/useDashboardStats.ts` | Coletar severidades do External Domain |

