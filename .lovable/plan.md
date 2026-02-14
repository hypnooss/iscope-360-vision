

# Fix: Masscan perdendo portas por packet loss em rate alto

## Problema Confirmado

Os logs mostram que o masscan completou 65535 portas em apenas 12 segundos (`rate=10000`) e encontrou apenas 4 portas. A porta **40443** (onde roda o FortiGate) foi perdida. Isso acontece porque:

1. **Rate muito alto**: 10.000 pacotes/segundo contra um unico IP causa packet loss -- o firewall do alvo pode fazer rate-limiting de SYN flood
2. **Sem retries**: o masscan envia um unico SYN por porta; se o pacote ou a resposta se perde, a porta e considerada fechada
3. **Wait curto**: `--wait 3` (3 segundos) pode nao ser suficiente para receber respostas tardias de portas altas

## Correcao

**Arquivo:** `python-agent/agent/executors/masscan.py`

### Mudancas nos parametros

| Parametro | Atual | Novo | Motivo |
|-----------|-------|------|--------|
| `rate` | 10000 | 3000 | Reduz packet loss contra firewalls com rate-limiting |
| `--retries` | (nenhum, default 0) | 2 | Reenvia SYN para portas sem resposta |
| `--wait` | 3 | 5 | Mais tempo para respostas tardias de portas altas |
| `timeout` | 120s | 180s | Acomoda o scan mais lento e os retries |

### Impacto no tempo

- **Atual**: ~12 segundos para 65535 portas (rate=10000, sem retries)
- **Novo**: ~65 segundos para 65535 portas (rate=3000, 2 retries, wait=5)
- Aumento de ~50 segundos por IP, mas com cobertura muito mais confiavel
- Com o multi-tasking ja implementado (4 threads), 10 IPs levarao ~3 minutos em vez de ~2 minutos -- aumento aceitavel

### Codigo

Alterar o bloco de construcao do comando (linhas 24-36):

```python
port_range = params.get('port_range', '1-65535')
rate = params.get('rate', 3000)
timeout = params.get('timeout', 180)

self.logger.info(f"[masscan] Scanning {ip} ports={port_range} rate={rate}")

cmd = [
    'masscan', ip,
    f'-p{port_range}',
    f'--rate={rate}',
    '--retries', '2',
    '-oJ', '-',
    '--wait', '5',
]
```

## Secao Tecnica

Apenas 1 arquivo modificado: `python-agent/agent/executors/masscan.py`, linhas 24-36.

As mudancas sao:
- Linha 25: default de `rate` muda de `10000` para `3000`
- Linha 26: default de `timeout` muda de `120` para `180`
- Linhas 30-36: adiciona `'--retries', '2'` ao array `cmd` e altera `'--wait'` de `'3'` para `'5'`

Os parametros continuam sendo sobreescriveis via `params` do blueprint, mantendo flexibilidade para casos especificos.

