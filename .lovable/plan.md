

## Plano: Adicionar legendas aos gráficos

Os gráficos atualmente não possuem legendas visuais. O gráfico de rede é o mais crítico (duas áreas: Enviado/Recebido), mas legendas simples em todos os gráficos melhoram a leitura.

### Mudanças

**Arquivo: `src/components/agents/AgentMonitorPanel.tsx`**

Importar `Legend` do recharts e adicionar legendas inline a cada gráfico:

| Gráfico | Legenda |
|---------|---------|
| CPU | `CPU %` (verde) |
| RAM | `Usado` (azul) + linha tracejada "Total" já existe |
| Disco | `Usado` (laranja) + linha tracejada "Total" já existe |
| Rede (espelhado) | `↑ Enviado` (roxo) + `↓ Recebido` (teal) — este é o mais importante |

Usar `<Legend>` do recharts com `formatter` customizado para exibir nomes legíveis (ex: "sentRate" → "↑ Enviado", "recvRateNeg" → "↓ Recebido"). Posicionar no topo do gráfico (`verticalAlign="top"`) com tamanho compacto (`fontSize: 10`).

Para CPU, RAM e Disco que têm apenas uma `Area`, uma legenda simples com o nome da métrica. Para Rede com duas áreas, a legenda é essencial para distinguir enviado/recebido.

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Importar `Legend`, adicionar `<Legend>` a cada `AreaChart` com formatação customizada |

