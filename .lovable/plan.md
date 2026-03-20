

## Plano: Remover degradê e usar Total como limite do eixo Y

### Mudanças em `AgentMonitorPanel.tsx`

**RAM (linhas 471-472):**
- Total: `fillOpacity={0.1}` → `fillOpacity={0}` (só linha, sem preenchimento)
- Usado: `fillOpacity={0.25}` → `fillOpacity={0}` (só linha, sem preenchimento)
- YAxis domain: já usa `ramTotal * 1.05` → mudar para exatamente `ramTotal` (sem margem)

**Disco — partições (linhas 506-507) e legado (linhas 530-531):**
- Total: `fillOpacity={0.1}` → `fillOpacity={0}`
- Usado: `fillOpacity={0.25}` → `fillOpacity={0}`
- YAxis domain: `totalGb * 1.05` → `totalGb` (sem margem)

Resultado: gráficos mostram apenas linhas sólidas (sem degradê/fill), e a linha Total toca exatamente o topo do eixo Y.

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | 6 Areas: fillOpacity→0; 3 YAxis: remover *1.05 |

