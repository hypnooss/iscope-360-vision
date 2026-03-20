

## Plano: Fixar eixo Y do disco no valor Total (estável)

### Problema
O `domain` do YAxis usa `latestPart?.total_gb` (partições) e `latest?.disk_total_gb` (legado), que dependem do último ponto de dados. Na carga inicial, `latest` pode ser `undefined` momentaneamente, fazendo o gráfico cair no `"auto"` e depois saltar quando os dados chegam — causando o comportamento das prints 1→2.

### Solução
Usar o valor máximo de `disk_total_gb` / `total_gb` de **todos** os pontos de métricas (não só o `latest`), garantindo estabilidade desde o primeiro render.

### Mudanças em `AgentMonitorPanel.tsx`

**Disco — partições (linha 484, 504):**
- Mudar `totalGb` de `latestPart?.total_gb ?? null` para `Math.max(...totalVals)` (já calculado na linha 485)
- Domain: `[0, totalGb ? totalGb : "auto"]` fica o mesmo, mas agora `totalGb` é estável

**Disco — legado (linha 528):**
- Calcular `diskTotalMax` a partir de todos os valores de `disk_total_gb` dos metrics
- Usar no domain em vez de `latest?.disk_total_gb`

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Disco partições: usar max de totalVals; Disco legado: usar max de todos disk_total_gb |

