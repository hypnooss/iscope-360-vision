

## Plano: Adicionar sufixo "GB" nos ticks do eixo Y dos gráficos de Disco

### Mudanças em `AgentMonitorPanel.tsx`

**Disco — partições (linha 504):**
- Adicionar `tickFormatter={(v) => `${v} GB`}` no `<YAxis>`

**Disco — legado (linha 528):**
- Adicionar `tickFormatter={(v) => `${v} GB`}` no `<YAxis>`

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | 2 YAxis: adicionar tickFormatter com sufixo "GB" |

