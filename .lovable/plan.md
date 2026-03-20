

## Plano: Disco total no título + Link speed + Gráfico de rede espelhado

### 3 mudanças solicitadas

1. **Disco** — Exibir tamanho total no título do gráfico (ex: "Disco — / (500 GB)")
2. **Rede — Link speed** — Coletar velocidade do link da interface (10/100/1000 Mbps) via `/sys/class/net/<iface>/speed` e exibir no título (ex: "Rede — eth0 (1 Gbps)")
3. **Gráfico de rede espelhado** — Enviado acima do eixo X, Recebido abaixo do eixo X, mas com labels sempre em valores positivos

### Implementação

**Etapa 1 — Collector: coletar link speed por interface**

Arquivo: `python-agent/monitor/executors/proc_read.py`

- No `_parse_net_interfaces`, ler `/sys/class/net/<iface>/speed` para cada interface
- Retornar `link_speed_mbps` em cada item do array `net_interfaces`:
  ```json
  {"iface": "eth0", "bytes_sent": 1234, "bytes_recv": 5678, "link_speed_mbps": 1000}
  ```
- Se não conseguir ler (interface virtual, etc.), enviar `null`

**Etapa 2 — Frontend: tipos e helpers**

Arquivo: `src/hooks/useAgentMetrics.ts`

- Adicionar `link_speed_mbps?: number | null` ao tipo `NetInterface`
- Alterar `buildInterfaceData` para incluir `recvRateNeg: -ni.bytes_recv` (valor negativo para o gráfico espelhado)
- Adicionar helper `getInterfaceSpeed(metrics, ifaceName)` que retorna o último `link_speed_mbps` conhecido
- Adicionar helper `formatLinkSpeed(mbps)` → "10 Mbps", "100 Mbps", "1 Gbps", "10 Gbps"

**Etapa 3 — Frontend: gráficos**

Arquivo: `src/components/agents/AgentMonitorPanel.tsx`

- **Disco**: alterar título de `Disco — /path (GB)` para `Disco — /path (usado / total GB)` incluindo o `total_gb` da última métrica
- **Rede — título**: incluir link speed formatado: `Rede — eth0 (1 Gbps)`
- **Gráfico espelhado**: 
  - Usar `AreaChart` com duas `Area`: `sentRate` (positivo, acima) e `recvRateNeg` (negativo, abaixo)
  - `YAxis` com `tickFormatter` que exibe `Math.abs(value)` formatado em bytes/s (nunca mostra negativo)
  - Tooltip também exibe valores absolutos
  - Cores: enviado (roxo) acima, recebido (teal) abaixo
  - `ReferenceLine y={0}` para marcar o eixo X central

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `python-agent/monitor/executors/proc_read.py` | Ler `/sys/class/net/<iface>/speed` |
| `src/hooks/useAgentMetrics.ts` | Tipo `NetInterface` + helpers link speed + recvRateNeg |
| `src/components/agents/AgentMonitorPanel.tsx` | Títulos disco/rede + gráfico espelhado |

### Sem mudanças em

- DB / migrations (link_speed já cabe no JSONB `net_interfaces`)
- Edge Function (já persiste o JSONB como recebido)
- Template/blueprint (o parser `net_interfaces` já coleta tudo)

