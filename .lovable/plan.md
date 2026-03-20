

## Plano: Restaurar degradê no "Usado" e manter só linha no "Total"

### Mudanças em `AgentMonitorPanel.tsx`

**RAM (linha 472):**
- Usado: `fill="none" fillOpacity={0}` → `fill="hsl(217, 71%, 45%)" fillOpacity={0.15}` (restaurar degradê)
- Total (linha 471): manter como está (sem fill)

**Disco — partições (linha 507):**
- Usado: `fill="none" fillOpacity={0}` → `fill="hsl(25, 95%, 53%)" fillOpacity={0.15}`
- Total (linha 506): manter como está

**Disco — legado (linha 531):**
- Usado: `fill="none" fillOpacity={0}` → `fill="hsl(25, 95%, 53%)" fillOpacity={0.15}`
- Total (linha 530): manter como está

**YAxis Disco — partições (linha 504):**
- `Math.ceil(totalGb)` → `totalGb` (valor exato do Total, sem arredondamento pra cima)

**YAxis Disco — legado (linha 528):**
- `Math.ceil(Number(latest.disk_total_gb))` → `Number(latest.disk_total_gb)`

Resultado: "Usado" volta a ter preenchimento degradê; "Total" fica só linha sólida; eixo Y do disco bate exatamente no valor Total.

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | 3 Areas Usado: restaurar fill; 2 YAxis disco: remover ceil |

