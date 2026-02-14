

# Fix: Masscan timeout tratado como falha de conectividade

## O que esta acontecendo

O rate=3000 por instancia nao e agressivo sozinho, mas com 4 scans paralelos (MAX_PARALLEL_TASKS=4), o total chega a 12.000 pps na mesma interface. Isso causa congestionamento e todos os scans estouram o timeout de 180s.

Alem disso, quando o masscan retorna "timeout", o tasks.py interpreta como falha de conectividade e aborta os steps nmap e httpx -- mesmo que o alvo esteja acessivel e simplesmente nao tenha portas abertas.

## Correcoes (3 alteracoes)

### 1. Reduzir rate para 1000 no blueprint

Com 4 instancias paralelas, 1000 x 4 = 4.000 pps total, bem dentro do seguro.

```sql
-- Nova migration SQL
UPDATE public.device_blueprints
SET collection_steps = jsonb_set(
  jsonb_set(
    collection_steps,
    '{steps,0,params}',
    '{"port_range": "1-65535", "rate": 1000}'::jsonb
  ),
  '{steps,0,timeout}',
  '300'::jsonb
),
updated_at = now()
WHERE name = 'Active Attack Surface Scan';
```

A 1000 pps, 65535 portas levam ~66s. Com retries e wait, ~140s. Dentro dos 300s mesmo com contencao.

### 2. Masscan executor: tratar timeout como resultado, nao erro

No `masscan.py`, mudar o tratamento de `subprocess.TimeoutExpired` para retornar portas vazias em vez de um erro. Isso evita que o fail-fast seja acionado.

```python
# Antes:
except subprocess.TimeoutExpired:
    return {'error': f'masscan timeout after {timeout}s on {ip}'}

# Depois:
except subprocess.TimeoutExpired as e:
    partial = (e.stdout or '').strip() if e.stdout else ''
    if partial:
        ports = self._parse_output(partial)
        self.logger.info(f"[masscan] Timeout on {ip}, partial: {len(ports)} ports")
        return {'data': {'ip': ip, 'ports': ports}}
    self.logger.info(f"[masscan] Timeout on {ip}, no ports found")
    return {'data': {'ip': ip, 'ports': []}}
```

Tambem atualizar o default do rate no executor de 3000 para 1000 para consistencia.

### 3. Tasks.py: excluir scanners do fail-fast de conectividade

Adicionar uma lista de executores de scanning que nao devem acionar o mecanismo de fail-fast, pois "timeout" e comportamento normal para eles.

```python
SCAN_EXECUTORS = {'masscan', 'nmap', 'httpx'}

# Na verificacao (linha ~233):
if i == 0 and result.get('error'):
    executor_type = step.get('type', '')
    if executor_type not in SCAN_EXECUTORS and self._is_connectivity_error(error_msg):
        # fail-fast logic (mantida para SSH, HTTP, SNMP, etc.)
```

## Resumo das alteracoes

| Arquivo | O que muda |
|---------|-----------|
| Migration SQL | rate: 3000 -> 1000, timeout: 180 -> 300 |
| `masscan.py` | Timeout retorna resultado vazio em vez de erro; default rate -> 1000 |
| `tasks.py` | Scanners (masscan/nmap/httpx) excluidos do fail-fast por conectividade |

## Por que essas 3 juntas

- So reduzir o rate: ainda vai dar fail-fast em scans sem portas abertas
- So corrigir o fail-fast: scans vao demorar demais com contencao de 12k pps
- So tratar timeout: sem reduzir rate, timeout parcial pode perder portas

As tres correcoes juntas resolvem o ciclo completo.

