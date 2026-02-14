

# Fix: Trocar -sS por -sT no executor de fingerprinting (nmap.py)

## Problema

O executor de fingerprinting (`nmap.py`) usa `-sS` (SYN stealth) combinado com `-sV` (version detection). Agora que o discovery vai encontrar portas corretamente com `-sT`, o fingerprinting vai receber essas portas e tentar escanea-las com `-sS` -- e o IPS do FortiGate vai bloquear da mesma forma.

Ate agora isso nao foi visivel porque o discovery falhava antes, e o fingerprinting recebia 0 portas.

## Solucao

Aplicar a mesma correcao do discovery: trocar `-sS` por `-sT` no `nmap.py`.

O `-sV` (version detection) funciona normalmente com `-sT` -- ele faz probes de aplicacao apos a conexao TCP estabelecida, independente do tipo de scan.

### Mudancas no arquivo `python-agent/agent/executors/nmap.py`

**Scan primario (linha 43-54):**
- Trocar `'sudo', 'nmap', '-sS', '-sV'` por `'nmap', '-sT', '-sV'`
- Remover `'--data-length', '24'` (incompativel com -sT)

**Scan fallback (linha ~73-84):**
- Trocar `'sudo', 'nmap', '-sS', '-sV'` por `'nmap', '-sT', '-sV'`
- Remover `'--data-length', '24'`

Todos os outros parametros (`-sV`, `--version-intensity`, `--script`, `--scan-delay`, `--host-timeout`, `-T3`) permanecem identicos e funcionam com `-sT`.

## Resumo

| Arquivo | Acao |
|---|---|
| `python-agent/agent/executors/nmap.py` | Trocar -sS por -sT, remover sudo e --data-length 24 (scan primario e fallback) |

