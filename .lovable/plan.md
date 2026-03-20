

## Plano: Alinhar legenda à direita com alinhamento vertical dos campos

### Mudança em `src/components/agents/AgentMonitorPanel.tsx`

Reescrever `ChartLegendTable` (linhas 70-93) para usar layout de grid em vez de flex, garantindo alinhamento vertical perfeito entre todas as linhas:

1. **Container**: `items-end` para alinhar o bloco à direita do chart
2. **Grid com colunas fixas**: Usar `display: grid` com `grid-template-columns` de 6 colunas: `[quadrado] [label] [last] [min] [avg] [max]` — isso garante que todos os valores ficam alinhados verticalmente entre linhas
3. **Alinhamento**: Valores numéricos com `text-right tabular-nums`, labels com `text-left`

```text
Estrutura por linha (grid 6 colunas):
  ■  |  CPU %   |  last: 8.3%  |  min: 7.7%  |  avg: 8.6%  |  max: 13.5%
  ■  |  Total   |  last: 3.4GB  |  min: 3.4GB  |  avg: 3.4GB  |  max: 3.4GB
  ■  |  Usado   |  last: 1.2GB  |  min: 1.1GB  |  avg: 1.2GB  |  max: 1.2GB
```

### Arquivo

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Reescrever `ChartLegendTable` com CSS grid + `items-end` no container pai |

