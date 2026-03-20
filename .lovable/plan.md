

## Plano: Gráficos de Métricas do Monitor no Agent Detail

### Resumo

Adicionar uma seção de monitoramento de performance na página de detalhes do agent (`/agents/:id`), logo acima do Remote Terminal, com gráficos de CPU, RAM, Disco e Rede baseados nos dados da tabela `agent_metrics`.

### O que será construído

**1. Hook `useAgentMetrics`** (`src/hooks/useAgentMetrics.ts`)
- Query na tabela `agent_metrics` filtrada por `agent_id`, ordenada por `collected_at`
- Parâmetro de intervalo de tempo (1h, 6h, 24h, 7d) para limitar os dados
- Auto-refresh a cada 60s (intervalo do monitor)
- Retorna os dados formatados para os gráficos

**2. Componente `AgentMonitorPanel`** (`src/components/agents/AgentMonitorPanel.tsx`)
- Card com título "Monitoramento" e seletor de período (1h / 6h / 24h / 7d)
- Layout em grid 2x2 com 4 gráficos:
  - **CPU** — `cpu_percent` ao longo do tempo (AreaChart, cor por faixa de uso)
  - **RAM** — `ram_percent` + tooltip mostrando `ram_used_mb / ram_total_mb`
  - **Disco** — `disk_percent` + tooltip com `disk_used_gb / disk_total_gb`
  - **Rede** — `net_bytes_sent` e `net_bytes_recv` (LineChart com 2 séries)
- Indicadores no topo: valor atual de CPU, RAM, Disco + uptime
- Estado vazio quando não há métricas (agent sem monitor ou recém-instalado)

**3. Integração no AgentDetailPage**
- Inserir `<AgentMonitorPanel agentId={agent.id} />` entre os cards existentes e o Remote Terminal (linha ~716)

### Detalhes Técnicos

- Reutilizar Recharts (já no projeto) com `AreaChart`, `LineChart`, `ResponsiveContainer`
- Padrão visual consistente com os sparklines existentes (`ScoreSparkline`)
- Tooltips com valores formatados em pt-BR
- Conversão de bytes de rede para KB/s ou MB/s calculando delta entre pontos consecutivos
- Cores por faixa: verde (<60%), amarelo (60-80%), vermelho (>80%)

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/hooks/useAgentMetrics.ts` |
| Criar | `src/components/agents/AgentMonitorPanel.tsx` |
| Editar | `src/pages/AgentDetailPage.tsx` |

