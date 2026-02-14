

# Estrategia de Discovery em 2 Fases com RTT Otimizado

## Resumo

Adaptar o `nmap_discovery.py` para usar a estrategia de 2 fases proposta, com os ajustes criticos de RTT que resolvem o problema real: o nmap espera tempo demais por portas com silent drop.

## Diagnostico do problema real

O problema nao e o tipo de scan (`-sT` vs `-sS`). O problema e que o nmap usa timeouts padrao (RTT) de **ate 10 segundos por porta** em ambientes com silent drop. Isso significa:

- 65.535 portas x ate 10s cada = impossivel terminar em 600s
- Mesmo com `--max-rate 300`, o nmap fica travado esperando respostas que nunca chegam

Os parametros `--initial-rtt-timeout`, `--max-rtt-timeout` e `--defeat-rst-ratelimit` sao a chave.

## Arquitetura proposta (dentro do nmap_discovery.py)

```text
CDN detectado?
  SIM -> Retorna 14 portas fixas (ja implementado)
  NAO -> Fase 1: Baseline rapido (top-ports 2000, ~30s)
           -> Analisa resultado
           -> Fase 2: Full range otimizado (1-65535 com RTT agressivo, ~2-4 min)
           -> Merge das duas fases
           -> Retorna portas unicas
```

### Fase 1 - Baseline rapido (~30s)

Objetivo: descobrir as portas mais comuns rapidamente e calibrar o comportamento do alvo.

```text
nmap -sS -Pn --open --top-ports 2000 -T4
     --max-retries 1
     --initial-rtt-timeout 150ms
     --max-rtt-timeout 400ms
     --host-timeout 60s
     -oX -
```

Nota sobre `-sS`: O Super Agent roda como root (necessario para masscan, que ja existia), portanto `-sS` e viavel. Mantemos `-sT` como fallback caso `-sS` falhe (permissao negada).

### Fase 2 - Full range otimizado (~2-4 min)

So roda se a Fase 1 encontrou pelo menos 1 porta (confirma que o host responde). Se a Fase 1 encontrou 0 portas, pula direto -- o httpx fara o fallback com suas portas default.

```text
nmap -sS -Pn --open -p- -T4
     --max-retries 1
     --initial-rtt-timeout 150ms
     --max-rtt-timeout 400ms
     --min-rate 800
     --max-rate 1500
     --defeat-rst-ratelimit
     --host-timeout 300s
     -oX -
```

Parametros criticos explicados:

| Parametro | Valor | Por que |
|---|---|---|
| `--initial-rtt-timeout` | 150ms | Nao esperar 1s+ por cada porta silenciosa |
| `--max-rtt-timeout` | 400ms | Teto maximo de espera por resposta |
| `--max-retries` | 1 | Nao insistir em portas filtradas |
| `--min-rate` | 800 | Garantir throughput minimo |
| `--max-rate` | 1500 | Evitar saturar o link |
| `--defeat-rst-ratelimit` | - | Evitar classificacao incorreta de portas |
| `-T4` | - | Timing agressivo (mas controlado pelos RTT acima) |

### Fallback: `-sS` para `-sT`

Se o `-sS` falhar com erro de permissao (improvavel, mas seguro), o sistema re-executa com `-sT` e os mesmos parametros de RTT.

## Mudancas no arquivo `python-agent/agent/executors/nmap_discovery.py`

1. Reescrever o metodo `run()` para implementar as 2 fases
2. Renomear `_run_scan()` e adicionar metodo `_run_phase()` que aceita parametros de fase
3. Remover a logica de false-positive (`FALSE_POSITIVE_THRESHOLD`) -- a estrategia de 2 fases com RTT controlado elimina ghost ports
4. Manter o CDN skip intacto (ja funciona)
5. Manter `_parse_xml()` intacto (ja funciona)
6. Usar `-sS` como default, fallback para `-sT` se subprocess retornar erro de permissao

### Compatibilidade

- Python 3.9: sem mudancas de syntax (sem `|` em type hints)
- `tasks.py`: sem mudancas (contexto propagado igual, formato de retorno identico)
- `nmap.py` (fingerprint): sem mudancas (recebe portas do contexto)
- `httpx_executor.py`: sem mudancas (recebe portas do contexto)
- Blueprint: sem mudancas (step ID `masscan_discovery` mantido)

### Tempo estimado por IP

| Cenario | Antes | Depois |
|---|---|---|
| CDN | 0s (skip) | 0s (skip) |
| Host responsivo | 600s (timeout, 0 portas) | ~2-4 min (portas reais) |
| Host silent drop total | 600s (timeout, 0 portas) | ~30s (fase 1 rapida, pula fase 2) |

