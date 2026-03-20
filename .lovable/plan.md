

## Diagnóstico: Por que `ip_addresses` retorna `null`

### Causa raiz

O problema **não** é o coletor legado. Todos os agentes estão com Monitor v1.1.4 e usando o coletor template-driven (`proc_read.py`), que **tem** o código de `_read_ip_addresses()`.

O problema está na **lógica de envio parcial** do `monitor/main.py`:

1. O blueprint define `interval_seconds` por step. O step `system_info` (que contém `ip_addresses`, `hostname`, `os_info`, `uptime`) provavelmente roda a cada **3600s** (1h), enquanto CPU/RAM/Disco/Rede rodam a cada 30-60s.

2. Na linha 167, o monitor envia `metrics` (payload parcial do ciclo atual), **não** o `cumulative_snapshot`. Isso significa que nos ciclos em que o step `system_info` não roda, o payload enviado **não contém** `ip_addresses`.

3. A edge function grava `body.ip_addresses ?? null` — ou seja, nos 59 de cada 60 registros, `ip_addresses` é `null`.

4. O frontend busca métricas do último período (1h por padrão) e usa `findLastNonNull`. Mas se o step `system_info` rodou há mais de 1h, **nenhum** registro no range terá o campo preenchido.

### Solução

Alterar o monitor para enviar o **cumulative_snapshot** (que já é mantido e mergeado) em vez do payload parcial. Isso garante que todo envio inclua os dados mais recentes de **todos** os steps, incluindo `ip_addresses`.

### Implementação

| Arquivo | Mudança |
|---------|---------|
| `python-agent/monitor/main.py` (linha 167) | Trocar `_send(api, metrics, logger)` por `_send(api, cumulative_snapshot, logger)` |
| `python-agent/monitor/version.py` | Bump para `1.1.5` |

A mudança é de **uma linha**. O `cumulative_snapshot` já é construído corretamente com `cumulative_snapshot.update(metrics)` na linha 163, acumulando todos os campos de todos os steps. Só falta enviá-lo.

### Impacto

- Todos os campos de intervalo longo (`ip_addresses`, `hostname`, `os_info`, `uptime_seconds`) passarão a estar presentes em **todo** registro de métricas
- O tamanho do payload aumenta marginalmente (poucos campos extras)
- Nenhuma mudança no backend ou frontend necessária

