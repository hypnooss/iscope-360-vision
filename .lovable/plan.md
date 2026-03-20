

## Plano: Ajustar escala dos gráficos e exibir Total como topo

### Problema 1: Escala do CPU
O gráfico de CPU usa `domain={[0, 100]}` fixo. Quando o uso é ~2%, o gráfico fica comprimido na base. A escala deve se adaptar aos dados reais, usando o valor máximo dos dados + margem.

### Problema 2: Total como topo nos gráficos de RAM e Disco
Atualmente o "Total" é apenas uma `ReferenceLine` tracejada. O usuário quer que a linha de Total seja desenhada como uma `Area` sólida no topo do gráfico, criando o efeito visual de "capacidade total" preenchida (como no print 2 — linha vermelha sólida no topo para Total, linha laranja para Usado).

### Mudanças em `AgentMonitorPanel.tsx`

**CPU:**
- Mudar `domain` de `[0, 100]` para `[0, (dataMax) => Math.max(10, Math.ceil(dataMax * 1.2))]` — escala dinâmica com 20% de margem, mínimo 10%.

**RAM:**
- Adicionar `dataKey="ram_total_mb"` como segunda `Area` (cor diferente, ex: azul mais claro) renderizada ANTES da área de usado para ficar atrás.
- Remover a `ReferenceLine` de Total.
- Manter `domain` baseado no `ramTotal`.

**Disco (partições e legado):**
- Adicionar `dataKey="disk_total_gb"` como segunda `Area` (cor vermelha como no print) renderizada antes da área de usado.
- Remover a `ReferenceLine` de Total.
- Manter `domain` baseado no `totalGb`.

### Cores (baseado no print 2)
- Disco Total: `hsl(0, 84%, 60%)` (vermelho) — linha sólida no topo
- Disco Usado: `hsl(25, 95%, 53%)` (laranja) — preenchido abaixo
- RAM Total: `hsl(217, 91%, 60%)` (azul claro) — linha sólida no topo  
- RAM Usado: `hsl(217, 71%, 45%)` (azul escuro) — preenchido abaixo

Também atualizar as cores nas legends correspondentes.

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | CPU: domain dinâmico; RAM/Disco: Total como Area + remover ReferenceLine |

