

# Fix: Trocar SYN scan (-sS) por TCP connect scan (-sT) no nmap_discovery

## Diagnostico confirmado pelos testes manuais

Os testes no console do Agent provaram definitivamente:

| Teste | Resultado |
|---|---|
| `nc -zv` (TCP connect) | 443, 444, 40443 **conectam** em 0.02s |
| `nmap -sT` (TCP connect scan) | 80, 443, 444, 40443 **encontrados** em 0.22s |
| `nmap -sS` com todos os parametros stealth | **0 portas** - IPS bloqueia |

O problema nao e rate, timing ou delay. O IPS do FortiGate detecta a **assinatura do SYN scan** (half-open TCP handshake) independente da velocidade. O `-sS` envia SYN, recebe SYN-ACK, mas envia RST em vez de completar o handshake - essa sequencia anomala e exatamente o que o IPS procura.

O `-sT` faz o handshake completo (SYN -> SYN-ACK -> ACK) que e indistinguivel de trafego legitimo.

## Solucao

Trocar `-sS` por `-sT` no `nmap_discovery.py`. Isso tambem elimina a necessidade de `sudo` (TCP connect nao requer raw sockets), mas vamos manter `sudo` por consistencia com o ambiente.

### Vantagens do `-sT` para discovery

- Passa por qualquer IPS sem deteccao (handshake completo = trafego normal)
- Mais confiavel em ambientes corporativos com firewalls stateful
- Nao precisa de raw sockets (funciona sem sudo/capabilities)
- O teste manual provou: 0.22s para encontrar 4 portas

### Trade-offs

- Ligeiramente mais lento que `-sS` em redes sem IPS (handshake completo vs half-open)
- Deixa log de conexao no alvo (TCP session established) - aceitavel para discovery de superficie de ataque

### Parametros ajustados

Com `-sT`, varios parametros de evasao de SYN scan se tornam desnecessarios, mas nao causam problema mante-los. A mudanca sera minima:

| Parametro | Antes | Depois | Motivo |
|---|---|---|---|
| `-sS` | SYN stealth | **`-sT`** (TCP connect) | Passa pelo IPS |
| `--scan-delay 200ms` | mantido | mantido | Ainda util para nao sobrecarregar |
| `--data-length 24` | mantido | **removido** | So se aplica a raw packets (SYN), ignorado pelo -sT |
| `--max-retries 1` | mantido | mantido | Reduz ruido |
| `-T2` | mantido | mantido | Timing conservador |
| `sudo` | necessario para -sS | **removido** | -sT nao requer raw sockets |

Comando resultante (non-CDN):
```text
nmap -sT -Pn --open -T2
  --max-retries 1
  --scan-delay 200ms
  --host-timeout 600s
  --max-rate 300
  -p 1-65535
  -oX -
  <ip>
```

Comando resultante (CDN):
```text
nmap -sT -Pn --open -T2
  --max-retries 1
  --scan-delay 200ms
  --host-timeout 600s
  --max-rate 150
  --top-ports 1000
  -oX -
  <ip>
```

## Mudancas

### Arquivo: `python-agent/agent/executors/nmap_discovery.py`

1. Linha 16: Atualizar docstring de "SYN stealth scan" para "TCP connect scan"
2. Linha 45: Atualizar log message de "Stealth SYN scan" para "TCP connect scan"
3. Linha 80: Remover `'sudo'` do comando (nao precisa mais de raw sockets)
4. Linha 81: Trocar `'-sS'` por `'-sT'`
5. Linha 87: Remover `'--data-length', '24'` (so funciona com raw packets)
6. Linhas 1-2: Atualizar comentario do modulo

Nenhuma outra mudanca necessaria. O parsing XML, timeouts e toda a logica de fallback permanecem identicos.

