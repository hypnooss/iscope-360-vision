
# Corrigir falhas do blueprint "External Domain DNS Scan" por ausência de registros DNS

## Diagnóstico

As screenshots mostram três padrões de erro:

1. `mx_records: The DNS response does not contain an answer` — exceção `NoAnswer` do dnspython
2. `dmarc_record: The DNS query name does not exist` — exceção `NXDOMAIN` do dnspython

Ambas caem no `except Exception` genérico do executor (linha 257 do `dns_query.py`) que retorna `error: str(e)`. Como nenhum dos steps no blueprint tem `optional: true`, o `tasks.py` classifica esses steps como `failed`, acumula erros e marca a tarefa inteira como `failed` ou `partial`.

Os steps afetados no blueprint `27b856b1-3b20-4180-b9da-ea5834c55ac6` (External Domain DNS Scan):

| Step ID | Query Type | Problema |
|---|---|---|
| `ns_records` | NS | NoAnswer / NXDOMAIN não capturado |
| `mx_records` | MX | NoAnswer / NXDOMAIN não capturado |
| `soa_record` | SOA | NoAnswer / NXDOMAIN não capturado |
| `spf_record` | SPF | _get_txt_records lança NXDOMAIN/NoAnswer |
| `dmarc_record` | DMARC | _get_txt_records lança NXDOMAIN/NoAnswer (confirmado nas screenshots) |

Os steps `dkim_records` e `dnssec_status` já tratam corretamente: DKIM tem `try/except` por seletor, e DNSSEC usa `try/except` em cada sub-query.

## Solução

### Mudança 1 — `python-agent/agent/executors/dns_query.py`

Adicionar tratamento explícito de `dns.resolver.NoAnswer` e `dns.resolver.NXDOMAIN` para cada query type que pode legitimamente não ter registros, retornando `records: []` (ou dados vazios) com `error: None` em vez de levantar exceção.

**MX** — envolver `resolver.resolve` num try/except específico:
```python
if query_type == 'MX':
    try:
        answers = resolver.resolve(domain, 'MX')
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        return {
            'status_code': 0,
            'data': {'query_type': 'MX', 'domain': domain, 'records': [], 'not_found': True},
            'error': None,
        }
    # ... resto da lógica
```

**NS** — mesmo padrão:
```python
if query_type == 'NS':
    try:
        answers = resolver.resolve(domain, 'NS')
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        return {
            'status_code': 0,
            'data': {'query_type': 'NS', 'domain': domain, 'records': [], 'not_found': True},
            'error': None,
        }
    # ...
```

**SOA** — mesmo padrão (retorna dados nulos em vez de lista):
```python
if query_type == 'SOA':
    try:
        answers = resolver.resolve(domain, 'SOA')
    except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN):
        return {
            'status_code': 0,
            'data': {'query_type': 'SOA', 'domain': domain, 'not_found': True},
            'error': None,
        }
    # ...
```

**SPF e DMARC** — o problema é que `_get_txt_records()` chama `resolver.resolve()` sem proteção. A solução é tornar `_get_txt_records()` tolerante a falhas:
```python
def _get_txt_records(self, resolver, name: str) -> List[str]:
    try:
        answers = resolver.resolve(name, 'TXT')
    except Exception:
        # NoAnswer, NXDOMAIN, timeout — retorna lista vazia
        return []
    # ... resto da lógica
```

Isso faz com que SPF retorne `raw: None, parsed: None` (domínio sem SPF) e DMARC retorne `raw: None, parsed: None` (domínio sem DMARC) — ambos resultados válidos que o relatório de compliance já trata como "não configurado".

### Mudança 2 — Blueprint no banco de dados (migration SQL)

Como segunda camada de proteção, marcar os steps `ns_records`, `mx_records`, `soa_record`, `spf_record` e `dmarc_record` como `optional: true` no blueprint. Isso garante que, mesmo se uma exceção inesperada ocorrer no futuro, o step será tratado como `not_applicable` em vez de `failed`.

A migration SQL será gerada e apresentada como instrução para execução no banco de dados.

## Arquivos modificados

- **`python-agent/agent/executors/dns_query.py`**: Tratamento de `NoAnswer`/`NXDOMAIN` para todos os tipos de query que podem legitimamente não ter registros.

## Migration SQL necessária (executar no banco)

```sql
-- Marcar steps DNS opcionais como optional: true no blueprint External Domain DNS Scan
UPDATE device_blueprints
SET collection_steps = jsonb_set(
  collection_steps,
  '{steps}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN step->>'id' IN ('ns_records', 'mx_records', 'soa_record', 'spf_record', 'dmarc_record')
        THEN jsonb_set(step, '{config,optional}', 'true'::jsonb)
        ELSE step
      END
    )
    FROM jsonb_array_elements(collection_steps->'steps') AS step
  )
)
WHERE id = '27b856b1-3b20-4180-b9da-ea5834c55ac6';
```

## Resultado esperado

- Domínio sem registros MX → step retorna `records: []`, status `success`, tarefa continua
- Domínio sem DMARC → step retorna `raw: null, parsed: null`, status `success`, tarefa continua
- Domínio sem SPF → mesmo comportamento do DMARC
- Tarefa completa com status `completed` independentemente de quais registros DNS o domínio possui
- Relatório de compliance mostra "Não Configurado" para os campos ausentes (comportamento já existente)
