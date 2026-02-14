

# Fix: max_rate ignorando estrategia CDN no nmap_discovery

## Problema

O blueprint "Active Attack Surface Scan" define `max_rate: 500` nos params do step `nmap_discovery`. O codigo atual usa `params.get('max_rate', 300)`, que so aplica o default 300 se o param **nao existir**. Como o blueprint envia 500 explicitamente, CDN IPs estao sendo escaneados com rate 500 em vez de 300.

Log evidenciando:
```
CDN detected (cloudflare), using top-1000 strategy on 104.26.14.188 max_rate=500
```

## Solucao

Alterar a logica no `nmap_discovery.py` para que, quando `is_cdn=True`, o `max_rate` seja fixado em 300 independente do que venha nos params do blueprint. Os params do blueprint so devem controlar o `max_rate` para IPs nao-CDN.

## Mudanca no Codigo

### Arquivo: `python-agent/agent/executors/nmap_discovery.py`

Alterar as linhas 32-40 (bloco CDN) de:

```python
if is_cdn:
    port_range = '--top-ports 1000'
    max_rate = params.get('max_rate', 300)
    timeout = params.get('timeout', 300)
```

Para:

```python
if is_cdn:
    port_range = '--top-ports 1000'
    max_rate = 300  # Fixed: CDN rate must be low to avoid blocking
    timeout = params.get('timeout', 300)
```

Isso garante que CDN IPs sempre usem taxa reduzida, sem depender dos params do blueprint.

Nenhum outro arquivo precisa ser alterado.

