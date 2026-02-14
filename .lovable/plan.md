

# Fix: nmap_discovery retornando 0 portas (conflito scan-delay vs host-timeout)

## Causa raiz

O parametro `--scan-delay 200ms` limita o nmap a no maximo 5 pacotes/segundo. Para escanear 65.535 portas a 5 pps sao necessarias ~3,6 horas. Porem o `--host-timeout 300s` encerra o scan apos 5 minutos, quando apenas ~1.500 portas foram sondadas. Resultado: 0 portas em todos os alvos.

## Correcao

Remover o `--scan-delay 200ms` fixo e confiar no timing adaptativo do `-T2` combinado com `--max-rate` para controlar a velocidade. Tambem aumentar o `--host-timeout` para ser compativel com o timeout do subprocess.

### Arquivo: `python-agent/agent/executors/nmap_discovery.py`

Mudancas no metodo `_run_scan` (bloco de construcao do comando nmap):

1. **Remover** a linha `'--scan-delay', '200ms'` - era o gargalo que impedia o scan de progredir
2. **Aumentar** `--host-timeout` de `300s` para `600s` - dar tempo suficiente para o scan completar com -T2
3. **Manter** todos os demais parametros de stealth (`-T2`, `--max-retries 2`, `--data-length 24`, `--min-rate 100`, `--max-rate`)

O resultado e que o nmap operara entre 100-500 pps (controlado por min/max-rate), completando 65.535 portas em ~2-10 minutos dependendo da rede, com o timing -T2 adaptando automaticamente a velocidade para evitar deteccao por IPS.

### Nenhuma outra mudanca necessaria

A logica de false-positive, parsing XML, e fallback por timeout permanecem inalterados.

