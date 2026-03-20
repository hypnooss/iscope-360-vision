

## Plano: Aumentar cards e corrigir gráficos sem dados

### Problema 1: Cards pequenos
Os cards de info usam `py-2` no `MetricIndicator`, resultando em altura reduzida.

**Solução:** Alterar padding de `py-2` para `py-3` no componente `MetricIndicator`.

### Problema 2: Gráficos CPU, RAM e Disco vazios
Com a arquitetura template-driven, cada step de coleta gera uma linha separada no banco. As métricas de CPU chegam em linhas diferentes das de RAM, Disco e Rede. O `chartData` inclui TODAS as linhas — a maioria delas tem `cpu_percent: null`, `ram_used_mb: null`, etc. O `AreaChart` do Recharts não renderiza pontos com valor null, resultando em gráficos vazios.

O gráfico de Rede funciona porque usa `buildInterfaceData()` que já filtra linhas sem dados.

**Solução:** Filtrar `chartData` para cada gráfico, mantendo apenas linhas onde o campo relevante não é null:
- CPU chart: filtrar onde `cpu_percent != null`
- RAM chart: filtrar onde `ram_used_mb != null`
- Disk chart: filtrar onde `disk_partitions` contém a partição (já usa `buildPartitionData`, mas precisa filtrar nulls)
- Disk legado: filtrar onde `disk_used_gb != null`

### Arquivo

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Aumentar padding dos cards; filtrar chartData por gráfico |

