

## Plano: Corrigir Escala de Rede + Suporte Multi-Interface

### Problema 1 — Escala errada (dupla divisão)

O collector Python já calcula **bytes/s** (delta bytes / elapsed seconds) antes de enviar. Porém o frontend (`computeNetworkRates`) trata os valores como contadores cumulativos e faz **outra divisão por tempo**, resultando em bytes/s² — valores ~60x menores que o real.

Dados da API confirmam: `net_bytes_recv: 4531` (bytes/s, ~36 Kbps). O frontend calcula `(4531 - 3993) / 60 = ~9 bytes/s` — exatamente os ~9.8 KB que você vê.

### Problema 2 — Sem nome de interface

O collector soma todas as interfaces em um único total (`_read_net_bytes` itera `/proc/net/dev` e soma tudo). Não há como saber qual interface gerou qual tráfego.

### Problema 3 — Sem suporte multi-interface

Similar ao que foi feito com `disk_partitions`, precisamos de uma coluna JSONB `net_interfaces` para armazenar dados por interface.

---

### Solução em 4 etapas

**Etapa 1 — Collector: coletar por interface**

Arquivo: `python-agent/monitor/collector.py`

- Alterar `_network()` para retornar dados **por interface** (mantendo compatibilidade)
- Ler `/proc/net/dev`, para cada interface (exceto `lo`), calcular delta bytes/s individual
- Enviar novo campo `net_interfaces` como lista JSONB:
  ```json
  [
    {"iface": "eth0", "bytes_sent": 1234, "bytes_recv": 5678},
    {"iface": "eth1", "bytes_sent": 100, "bytes_recv": 200}
  ]
  ```
- Manter `net_bytes_sent` e `net_bytes_recv` como soma total (backward compat)

**Etapa 2 — DB + Edge Function: persistir net_interfaces**

- Migration: adicionar coluna `net_interfaces JSONB` na tabela `agent_metrics`
- Edge Function `agent-monitor`: salvar `body.net_interfaces` no insert

**Etapa 3 — Frontend: corrigir escala e exibir por interface**

Arquivo: `src/hooks/useAgentMetrics.ts`
- Remover `computeNetworkRates` (a dupla divisão)
- Os dados já vêm como bytes/s, usar diretamente
- Adicionar tipo `NetInterface` e helpers para extrair interfaces únicas

Arquivo: `src/components/agents/AgentMonitorPanel.tsx`
- Se `net_interfaces` presente: renderizar um gráfico por interface (como discos)
- Se ausente (dados antigos): fallback para gráfico único com `net_bytes_sent/recv`
- Título de cada gráfico: `Rede — eth0`, `Rede — eth1`, etc.
- Usar valores diretos das métricas (sem computeNetworkRates)

**Etapa 4 — Bump Monitor version**

- `python-agent/monitor/version.py` → 1.1.2
- Reempacotar e atualizar `system_settings`

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `python-agent/monitor/collector.py` | Coletar rede por interface, campo `net_interfaces` |
| `python-agent/monitor/version.py` | 1.1.1 → 1.1.2 |
| `supabase/functions/agent-monitor/index.ts` | Aceitar e persistir `net_interfaces` |
| Migration SQL | `ALTER TABLE agent_metrics ADD COLUMN net_interfaces JSONB` |
| `src/hooks/useAgentMetrics.ts` | Remover `computeNetworkRates`, adicionar tipos para interfaces |
| `src/components/agents/AgentMonitorPanel.tsx` | Gráficos por interface, usar dados diretos |

### Compatibilidade

- Agents com monitor antigo (sem `net_interfaces`): frontend faz fallback para `net_bytes_sent/recv` em gráfico único
- A escala será corrigida imediatamente para todos os agents (sem necessidade de update do monitor), pois a correção da dupla divisão é apenas frontend

