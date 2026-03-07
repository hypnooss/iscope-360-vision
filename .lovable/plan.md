

## Fix: Cores do gráfico "Serviços Afetados" na Saúde do M365

### Problema
O gráfico de barras horizontais está usando `<rect>` para colorir as barras, mas o componente correto do Recharts é `<Cell>`. Isso faz com que as barras fiquem escuras/pretas contra o fundo dark, tornando o gráfico ilegível.

### Solução
Em `src/pages/m365/M365ServiceHealthPage.tsx`:

1. Importar `Cell` do recharts
2. Substituir `<rect key={i} fill={...} />` por `<Cell key={i} fill={...} />`
3. Usar uma paleta de cores com melhor contraste no tema dark — tons mais vibrantes de ciano, azul, roxo, verde, âmbar

### Mudança
- Arquivo: `src/pages/m365/M365ServiceHealthPage.tsx`
- Linha ~21: adicionar `Cell` ao import do recharts
- Linhas ~438-440: trocar `<rect>` por `<Cell>`
- Opcionalmente ajustar `BAR_COLORS` para cores mais vibrantes

