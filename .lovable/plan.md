

# Ajustar Timing do Nmap Fingerprint: T4 -> T3

## Mudanca

**Arquivo: `python-agent/agent/executors/nmap.py`**

Trocar `-T4` por `-T3` em dois lugares:

1. **Scan primario** (linha ~66): o scan com `--version-intensity 5` e scripts `banner,ssl-cert`
2. **Scan fallback** (linha ~100): o scan com `--version-intensity 3` e script `banner`

O scan de **enriquecimento NSE** (linha ~147) permanece com `-T4` -- ele nao faz deteccao de versao, apenas roda scripts pontuais por porta.

## Rollback

Se o `-T3` nao resolver ou deixar o scan muito lento, basta reverter as duas linhas de volta para `-T4`. Vou deixar um comentario no codigo indicando isso.

## Impacto esperado

| Metrica | T4 (atual) | T3 (novo) |
|---|---|---|
| Probe timeout interno | ~1.25s | ~5s |
| Tempo por IP (pior caso) | ~30-60s | ~60-120s |
| Taxa de fingerprint em hosts com IPS | Baixa (fallback frequente) | Deve melhorar significativamente |

O `--host-timeout 120s` do primario e `60s` do fallback continuam como teto de seguranca.

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `python-agent/agent/executors/nmap.py` | `-T4` -> `-T3` nos scans primario e fallback, com comentario de rollback |

