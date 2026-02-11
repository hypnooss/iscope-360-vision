

# Ajustes Visuais nos Cards do Dashboard

## 1. Sparkline em barras (acima da barra de progresso)

Alterar o `ScoreSparkline` de `AreaChart` para `BarChart` com barras verticais, usando a mesma cor do score/barra horizontal. Reposicionar o sparkline para ficar **acima** da barra de progresso (em vez de ao lado), ocupando toda a largura disponivel.

**Arquivo**: `src/components/dashboard/ScoreSparkline.tsx`
- Trocar `AreaChart` + `Area` por `BarChart` + `Bar`
- Aumentar largura para 100% (em vez de 120px fixo)
- Manter altura compacta (~40px)
- Usar a cor do modulo (ja passada via prop `color`)

**Arquivo**: `src/pages/GeneralDashboardPage.tsx`
- Mover `ScoreSparkline` para **acima** da linha de score/barra, ocupando largura total
- Layout vertical: sparkline -> score label + valor + barra horizontal

## 2. Badges de conformidade distribuidas horizontalmente

**Arquivo**: `src/pages/GeneralDashboardPage.tsx`
- Na `SeverityBadgeRow`, trocar `flex flex-wrap gap-1.5` por `flex gap-2 justify-start` com badges de tamanho mais uniforme
- Usar `flex-wrap` mas com gap maior e badges com padding adequado para nao ficarem comprimidas

## 3. CVEs de Firewall ausentes

O hook `useTopCVEs` busca CVEs do campo `report_data` da `analysis_history`. Pode estar falhando porque a estrutura do JSON nao bate. Adicionar logs e verificar. Tambem garantir que o `statsKey` "firewall" esta sendo corretamente mapeado ao renderizar o card.

**Arquivo**: `src/hooks/useTopCVEs.ts`
- Melhorar a extracao: tentar mais caminhos no JSON (`report_data.cves`, `report_data.vulnerabilities`, `report_data.results.cves`, etc.)
- Adicionar fallback robusto

## 4. Botao "Conformidade" do Dominio Externo alinhado

No card sem CVEs, o botao "Conformidade" ocupa `flex-1` mas nao tem par. Para alinhar com os outros cards (que tem 2 botoes lado a lado), fazer o botao unico ocupar a largura total com a mesma altura e estilo.

**Arquivo**: `src/pages/GeneralDashboardPage.tsx`
- No footer dos quick actions, quando nao ha botao de CVEs, o botao "Conformidade" deve ter `w-full` em vez de `flex-1`
- Manter o `mt-auto` no container de acoes para empurrar os botoes para o fundo do card, garantindo alinhamento vertical entre cards

## Resumo das Mudancas

| Arquivo | Alteracao |
|---|---|
| `src/components/dashboard/ScoreSparkline.tsx` | Trocar AreaChart por BarChart, largura 100% |
| `src/pages/GeneralDashboardPage.tsx` | Reposicionar sparkline acima da barra; distribuir badges; alinhar botoes; usar `mt-auto` no footer |
| `src/hooks/useTopCVEs.ts` | Melhorar extracao de CVEs do report_data com mais caminhos de fallback |

