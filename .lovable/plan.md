
# Otimizacao do nmap.py (Fingerprint) - Alinhamento com a Estrategia de 3 Fases

## Contexto

O `nmap_discovery.py` ja foi ajustado com RTT otimizado e 2 fases. Porem, o `nmap.py` (fingerprint) ainda usa parametros lentos que contradizem a estrategia. Os testes manuais confirmaram que a estrategia funciona: discovery em 7s + full range em 87s + fingerprint em 24s.

## Problema atual no nmap.py

```text
Parametro atual         | Problema
-T3                     | Timing conservador desnecessario (portas ja confirmadas open)
--scan-delay 500ms      | Atraso artificial entre probes
--host-timeout 300s     | 5 minutos para fingerprint em poucas portas
--max-retries 2         | Insiste em portas que ja sabemos estar abertas
--version-intensity 7   | Pesado demais como tentativa primaria
```

## Mudancas propostas no `python-agent/agent/executors/nmap.py`

### 1. Scan primario mais rapido

Ajustar o comando principal:

```text
Antes:  nmap -sT -sV --version-intensity 7 --script=banner,ssl-cert,http-title -T3 --host-timeout 300s --scan-delay 500ms --max-retries 2
Depois: nmap -sT -sV --version-intensity 5 --script=banner,ssl-cert -T4 --host-timeout 120s --max-retries 1
```

Mudancas especificas:
- `-T4` em vez de `-T3` (portas ja confirmadas abertas, nao precisa ser conservador)
- Remover `--scan-delay 500ms` (atraso desnecessario)
- `--host-timeout 120s` em vez de `300s` (fingerprint em poucas portas nao precisa de 5 min)
- `--max-retries 1` em vez de `2`
- `--version-intensity 5` em vez de `7` (mais rapido, ainda eficaz)
- Remover `http-title` dos scripts (httpx ja faz isso melhor e mais rapido)

### 2. Fallback mais leve

Ajustar o fallback (quando o scan primario nao encontra fingerprints):

```text
Antes:  nmap -sT -sV --version-intensity 5 --script=banner -T3 --host-timeout 180s --max-retries 1
Depois: nmap -sT -sV --version-intensity 3 --script=banner -T4 --host-timeout 60s --max-retries 1
```

- `--version-intensity 3` (mais leve, captura pelo menos banners)
- `--host-timeout 60s` em vez de `180s`
- `-T4` consistente

### 3. Limite de portas

Manter o limite de 100 portas (ja existente e adequado para fingerprint).

## Impacto esperado

| Cenario | Antes | Depois |
|---|---|---|
| Fingerprint em 5 portas | ~60-120s | ~15-30s |
| Fingerprint em 20 portas | ~120-300s | ~30-60s |
| Fallback (sem fingerprint) | ~180s extra | ~60s extra |

## Arquivos afetados

- `python-agent/agent/executors/nmap.py` - unico arquivo modificado

## Sem impacto em

- `nmap_discovery.py` (ja ajustado)
- `httpx_executor.py` (recebe portas do contexto, sem mudanca)
- `tasks.py` (formato de retorno identico)
- Blueprints (step IDs mantidos)
