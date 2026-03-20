

## Plano: Substituir cards de status por informações do sistema

### Contexto
Os 4 cards do topo (CPU, RAM, Disco, Uptime) perderam seus valores após a atualização do monitor. Como CPU, RAM e Disco já são exibidos nos gráficos abaixo, vamos substituir os cards por informações de sistema.

### Dados disponíveis em `agent_metrics`
- `hostname` ✅
- `os_info` ✅  
- `uptime_seconds` ✅
- IP ❌ — **não existe** na tabela `agent_metrics`

### Sobre o IP
O campo IP não está disponível nas métricas coletadas. Para incluí-lo seria necessário:
1. Adicionar a coleta de IP no blueprint do monitor (alteração no agente Python + migração no banco)
2. Ou buscar de outra fonte

**Recomendação:** Implementar os 3 cards disponíveis agora (Hostname, SO, Uptime) e adicionar o IP futuramente quando o blueprint for atualizado para coletá-lo.

### Mudanças em `AgentMonitorPanel.tsx`

Substituir os 4 `MetricIndicator` atuais (CPU, RAM, Disco, Uptime) por 3 cards de informação:

| Card | Ícone | Dados |
|------|-------|-------|
| Hostname | `Monitor` | `latest.hostname` |
| Sistema Operacional | `Cpu` | `latest.os_info` |
| Uptime | `Clock` | `formatUptime(latest.uptime_seconds)` |

- Alterar o grid de `grid-cols-2 md:grid-cols-4` para `grid-cols-1 md:grid-cols-3`
- Remover o hostname do título do card (já que terá card próprio)
- Remover os indicadores de cor (não são métricas de saúde)

### Arquivo

| Arquivo | Mudança |
|---------|---------|
| `src/components/agents/AgentMonitorPanel.tsx` | Substituir MetricIndicators por cards de info do sistema |

