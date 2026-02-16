

# Fix: Adicionar `-Pn` ao executor de fingerprinting

## Causa raiz

O executor `nmap_discovery.py` usa `-Pn` (skip host discovery), mas o `nmap.py` (fingerprint) nao usa. Sem `-Pn`, o nmap tenta pingar o host antes de escanear. Hosts que nao respondem ICMP (firewalls, IPS) sao classificados como "down" e o nmap pula o scan inteiro -- retornando 0 servicos.

## Correcao

### Arquivo: `python-agent/agent/executors/nmap.py`

Adicionar `-Pn` em 3 locais:

1. **Scan primario** (linha 76-86): adicionar `'-Pn'` ao comando
2. **Scan fallback** (linha 111-120): adicionar `'-Pn'` ao comando  
3. **Scan de enriquecimento NSE** (metodo `_enrich_with_contextual_scripts`, ~linha 195): adicionar `'-Pn'` ao comando

```python
# Antes (scan primario):
cmd = [
    'nmap', '-sT', '-sV',
    '--version-intensity', '5',
    ...
]

# Depois:
cmd = [
    'nmap', '-sT', '-Pn', '-sV',
    '--version-intensity', '5',
    ...
]
```

A mesma mudanca nos outros dois comandos.

## Justificativa

As portas ja foram confirmadas como abertas pelo `nmap_discovery`. Nao faz sentido o fingerprint refazer host discovery. O `-Pn` e seguro aqui porque ja sabemos que o host esta ativo.

## Impacto

- Corrige o problema de 0 servicos em hosts que bloqueiam ICMP
- Torna o fingerprint mais rapido (pula a fase de ping)
- Nenhum risco: as portas ja foram validadas pelo passo anterior do pipeline

