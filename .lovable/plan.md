

## Plano: Legendas estilo Zabbix abaixo dos gráficos

Inspirado no print do Zabbix, adicionar uma tabela de legendas abaixo de cada gráfico com estatísticas resumidas (last, min, avg, max).

### Mudanças

**Arquivo: `src/components/agents/AgentMonitorPanel.tsx`**

1. Criar componente `ChartLegendTable` que recebe um array de séries, cada uma com: `color`, `label`, `values: { last, min, avg, max }` e `unit`. Renderiza uma mini-tabela abaixo do gráfico com colunas: cor + nome | last | min | avg | max.

2. Calcular estatísticas a partir dos dados do gráfico usando `useMemo`:
   - **CPU**: 1 linha — `CPU %` com last/min/avg/max do `cpu_percent`
   - **RAM**: 2 linhas — `Total` (constante, last/min/avg/max do `ram_total_mb`) + `Usado` (last/min/avg/max do `ram_used_mb`), valores formatados em GB quando >= 1024 MB
   - **Disco**: 2 linhas por partição — `Total` + `Usado`, em GB
   - **Rede**: 2 linhas por interface — `↑ Enviado` e `↓ Recebido`, formatados em bytes/s

3. Mover `<Legend>` do recharts de `verticalAlign="top"` para remover completamente — substituído pela tabela customizada abaixo do gráfico.

4. Estilo da tabela: `text-[10px]`, sem bordas visíveis, com quadrado colorido 8x8 antes do nome da série. Colunas alinhadas: nome à esquerda, valores à direita. Fundo sutil `bg-muted/30` com `rounded-md` e `px-3 py-1.5`.

### Exemplo visual (CPU)

```text
┌──────────────────────────────────────────────┐
│  ■ CPU %     last: 23.4%  min: 12.1%        │
│              avg: 18.7%   max: 45.2%         │
└──────────────────────────────────────────────┘
```

### Exemplo visual (RAM)

```text
┌──────────────────────────────────────────────┐
│  ■ Total      last: 3.4 GB  min: 3.4 GB     │
│               avg: 3.4 GB   max: 3.4 GB      │
│  ■ Usado      last: 1.2 GB  min: 1.1 GB     │
│               avg: 1.2 GB   max: 1.2 GB      │
└──────────────────────────────────────────────┘
```

### Helper

Criar função utilitária `computeSeriesStats(values: number[])` → `{ last, min, avg, max }` para reutilizar em todos os gráficos.

### Arquivo a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Remover `<Legend>`, criar `ChartLegendTable`, calcular stats, renderizar abaixo de cada gráfico |

