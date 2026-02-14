

# Fix: Adicionar `sudo` ao nmap_discovery para `-sS`

## Problema

O agente nao tem `CAP_NET_RAW` herdada pelo nmap (binario dinamicamente linkado ignora capabilities), entao todo `-sS` falha com "permission denied" e faz fallback para `-sT`. Isso acontece em **cada fase, para cada IP** -- duplicando execucoes desnecessariamente.

## Solucao

Adicionar `sudo` ao comando quando o scan_type for `-sS`, conforme a arquitetura documentada (sudoers com `NOPASSWD` para nmap).

## Mudanca no arquivo

**`python-agent/agent/executors/nmap_discovery.py`** - metodo `_build_cmd()`:

Quando `scan_type == '-sS'`, prefixar o comando com `sudo`:

```text
Antes:  ['nmap', '-sS', '-Pn', ...]
Depois: ['sudo', 'nmap', '-sS', '-Pn', ...]
```

Para `-sT` (fallback ou direto), manter sem `sudo`:

```text
['nmap', '-sT', '-Pn', ...]
```

## Pre-requisito no servidor

Confirmar que o sudoers do Super Agent tem:

```text
precisio-agent ALL=(root) NOPASSWD: /usr/bin/nmap
```

Se nao tiver, o fallback para `-sT` continua funcionando como hoje (sem regressao).

## Impacto

- Elimina as tentativas duplicadas (nao precisa mais falhar e retry)
- Habilita SYN stealth scan (mais rapido, menos detectavel)
- Zero risco: se `sudo` falhar, o fallback `-sT` continua igual

