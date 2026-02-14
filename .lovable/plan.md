

# Fix: nmap_discovery nao encontra portas em hosts com IPS (FortiGate)

## Diagnostico

O scan mais recente de `187.32.89.65` mostra:
- `nmap_discovery` rodou por **420s** e encontrou **0 portas**
- Nem mesmo portas 80 e 443 (que o httpx confirma abertas com titulo "FortiGate")
- Portas 444 e 40443 nunca foram descobertas

O IPS do FortiGate esta detectando o scan e bloqueando o IP de origem. A causa raiz e a configuracao atual do nmap:

```text
--min-rate 100   <-- FORCA 100 pacotes/segundo, ANULA o -T2
--max-rate 500   <-- permite ate 500 pps
(sem --scan-delay entre probes)
```

O `-T2` ("polite") deveria adaptar o ritmo ao ambiente, mas o `--min-rate 100` impoe um piso de 100 SYN/s que o IPS identifica instantaneamente como scan. Apos detecao, o FortiGate dropa silenciosamente TODOS os pacotes subsequentes do nosso IP - por isso ate 80/443 desaparecem.

Nota: o executor de fingerprinting (`nmap.py`) ja usa `--scan-delay 500ms` e NAO usa `--min-rate` - por isso nao sofre o mesmo problema. A discovery precisa seguir a mesma filosofia.

## Solucao

Reconfigurar o `_run_scan` no `nmap_discovery.py` para evasao real de IPS:

### Mudancas no comando nmap

| Parametro | Antes | Depois | Motivo |
|---|---|---|---|
| `--min-rate` | 100 | **removido** | Deixar o -T2 controlar o ritmo adaptativamente |
| `--max-rate` | 500 (param) | 300 (non-CDN) / 150 (CDN) | Teto mais conservador |
| `--scan-delay` | nao existia | `200ms` | Espacamento entre probes evita deteccao de burst |
| `--max-retries` | 2 | 1 | Menos retransmissoes = menos ruido |
| `-T2` | sim | mantido | Timing polite com adaptacao |
| `--data-length` | 24 | mantido | Padding de pacotes |

Comando resultante (non-CDN):
```text
sudo nmap -sS -Pn --open -T2
  --max-retries 1
  --scan-delay 200ms
  --data-length 24
  --host-timeout 600s
  --max-rate 300
  -p 1-65535
  -oX -
  <ip>
```

Comando resultante (CDN):
```text
sudo nmap -sS -Pn --open -T2
  --max-retries 1
  --scan-delay 200ms
  --data-length 24
  --host-timeout 600s
  --max-rate 150
  --top-ports 1000
  -oX -
  <ip>
```

### Ajuste de timeout

Sem `--min-rate`, o scan full (65535 portas) sera mais lento. O timeout do blueprint precisa acomodar:

- 65535 portas / ~200 probes por segundo (rate efetivo com delay) = ~328 segundos teorico
- Com retransmissoes e adaptacao: ~600-700 segundos pratico
- Timeout do executor: manter `--host-timeout 600s`
- Timeout do subprocess: aumentar de 420s para **720s** (12 minutos)
- Timeout do blueprint step: atualizar de 420 para **750** via SQL

### Impacto no tempo de scan

- Antes: 420s (7 min) e 0 portas encontradas (IPS bloqueou)
- Depois: ~600s (10 min) com portas reais encontradas
- Trocar 3 minutos a mais por resultados reais e um tradeoff obvio

## Arquivo e mudancas

### 1. `python-agent/agent/executors/nmap_discovery.py`

No metodo `_run_scan`, alterar a construcao do comando:

- Remover `'--min-rate', '100'` completamente
- Adicionar `'--scan-delay', '200ms'`
- Alterar `'--max-retries'` de `'2'` para `'1'`
- Manter todo o resto identico

No metodo `run`, ajustar os defaults:
- non-CDN: `max_rate` default de 500 para 300, `timeout` default de 420 para 720
- CDN: `max_rate` fixo de 300 para 150, `timeout` default de 300 para 420

### 2. Blueprint (SQL) - Atualizar timeout do step

Atualizar o timeout do step `masscan_discovery` de 420 para 750 no blueprint "Active Attack Surface Scan" para acomodar o scan mais lento.

## Resumo

| Arquivo | Acao |
|---|---|
| `python-agent/agent/executors/nmap_discovery.py` | Remover min-rate, adicionar scan-delay, ajustar rates e timeouts |
| Blueprint (SQL) | Timeout do step de discovery: 420 -> 750 |

