

## Plano: Monitor Template-Driven (sem módulo Endpoint) — ✅ IMPLEMENTADO

### Resumo do que foi feito

1. **Executors criados em `monitor/executors/`**:
   - `base.py` — classe base `MonitorExecutor`
   - `proc_read.py` — parser para cpu, memory, net_interfaces, system (lógica extraída do collector.py)
   - `statvfs.py` — coleta de disco via /proc/mounts + os.statvfs
   - `__init__.py` — registry de executors por tipo

2. **Template "linux_server" no banco**:
   - Enum `blueprint_executor_type` expandido com valor `monitor`
   - `device_type` inserido: code=`linux_server`, vendor=Linux, category=server
   - `device_blueprint` inserido com 5 steps (cpu, mem, disk, net, sys)

3. **Monitor refatorado (`monitor/main.py`)**:
   - Boot: busca blueprint via Edge Function `agent-monitor-blueprint`
   - Cache local em `/var/lib/iscope-agent/monitor_blueprint.json`
   - Refresh do blueprint a cada 30 min
   - Itera steps do blueprint, instancia executors, agrega resultados
   - Fallback: se blueprint indisponível, usa `collector.py` legado

4. **Edge Function `agent-monitor-blueprint`**:
   - GET com `?device_type=linux_server`
   - Retorna blueprint ativo com steps

5. **Version bumped para 1.1.3**

### Compatibilidade

- `collector.py` mantido intacto como fallback
- Edge Function `agent-monitor` — mesmo payload (sem mudanças)
- Frontend — sem mudanças
- Agents antigos continuam funcionando normalmente

---

## Plano: Intervalo de coleta por step — ✅ IMPLEMENTADO (v1.1.4)

### Resumo

Cada step do blueprint agora possui `interval_seconds`, permitindo frequências
de coleta diferentes por métrica. O monitor calcula o `base_interval` como o
menor intervalo entre todos os steps e só executa cada step quando seu timer
individual vence.

### Blueprint atualizado

| Step | Intervalo |
|------|-----------|
| cpu  | 60s       |
| mem  | 60s       |
| disk | 120s      |
| net  | 30s       |
| sys  | 3600s     |

### Mudanças técnicas

- `monitor/main.py`: dict `last_collected_at` por step_id, `_compute_base_interval()`, envio parcial, snapshot incremental
- `monitor/version.py`: 1.1.3 → 1.1.4
- Migration: UPDATE do blueprint com `interval_seconds` por step
