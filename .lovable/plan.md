

## Plano: Valores absolutos nos gráficos + suporte a múltiplas partições

### Resumo

Melhorar os gráficos de CPU, RAM e Disco para mostrar valores absolutos além da porcentagem, e adicionar suporte a múltiplas partições de disco no collector, backend e frontend.

---

### 1. Frontend — Gráficos com valores absolutos

**Arquivo:** `src/components/agents/AgentMonitorPanel.tsx`

- **CPU**: Manter gráfico de `cpu_percent`. No indicador do topo, mostrar `cpu_percent% (N cores)`. Tooltip já mostra cores.
- **RAM**: Trocar eixo Y de 0-100% para valores em MB. Exibir `ram_used_mb` como área preenchida com `ram_total_mb` como linha de referência (teto). Label: "RAM (MB)". Indicador do topo: `X MB / Y MB (Z%)`.
- **Disco**: Mesmo padrão — eixo Y em GB com `disk_used_gb` como área e `disk_total_gb` como referência. Indicador: `X GB / Y GB (Z%)`.
- **Múltiplas partições**: Se existir `disk_partitions` no dado, renderizar um gráfico separado por partição (ex: "Disco — /", "Disco — /data").

### 2. Collector — Múltiplas partições

**Arquivo:** `python-agent/monitor/collector.py`

- Alterar `_disk()` para ler `/proc/mounts` e coletar métricas de todas as partições reais (excluindo pseudo-filesystems como tmpfs, devtmpfs, proc, sysfs, etc).
- Retornar `disk_partitions`: lista de objetos `{path, total_gb, used_gb, percent}`.
- Manter `disk_total_gb`, `disk_used_gb`, `disk_percent`, `disk_path` do `/` para compatibilidade.

### 3. Database — Nova coluna JSONB

**Migração SQL:**
```sql
ALTER TABLE agent_metrics 
ADD COLUMN IF NOT EXISTS disk_partitions jsonb DEFAULT NULL;
```

Armazena array de partições: `[{"path":"/","total_gb":50,"used_gb":30,"percent":60}, ...]`

### 4. Edge Function — Persistir partições

**Arquivo:** `supabase/functions/agent-monitor/index.ts`

- Adicionar `disk_partitions: body.disk_partitions ?? null` no insert.

### 5. Hook — Expor dados de partições

**Arquivo:** `src/hooks/useAgentMetrics.ts`

- Adicionar `disk_partitions` ao tipo `AgentMetricRow`.

---

### Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `python-agent/monitor/collector.py` |
| Migração | `agent_metrics` — coluna `disk_partitions jsonb` |
| Editar | `supabase/functions/agent-monitor/index.ts` |
| Editar | `src/hooks/useAgentMetrics.ts` |
| Editar | `src/components/agents/AgentMonitorPanel.tsx` |

