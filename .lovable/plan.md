
# Substituir Masscan por Nmap para descoberta de portas

## Problema diagnosticado

O masscan esta falhando sistematicamente em dois cenarios:

1. **Firewalls com IPS** (187.32.89.65): SYN flood do masscan e bloqueado - 0 portas em 3 tentativas consecutivas
2. **Infraestrutura cloud** (3.33.130.190 AWS): masscan retorna 33.000+ portas falsas, quebrando o httpx com "Argument list too long"

## Solucao: Nmap como motor unico de scan

Substituir o step `masscan_discovery` por um novo executor `nmap_discovery` que faz scan de portas usando nmap com tecnicas de evasao. O nmap com SYN scan + timing conservador + data-length consegue passar por IPS porque nao faz burst de pacotes.

### Diferenciais vs masscan

- Timing adaptativo (`-T2`) em vez de rate fixo - respeita RTT e evita deteccao
- Fragmentacao e padding de pacotes (`--data-length`, `--mtu`)
- Scan-delay entre probes - nao aciona thresholds de IPS
- Melhor handling de falsos positivos (nmap valida handshake)
- Possibilidade de limitar portas top-N para alvos cloud

## Mudancas

### 1. Novo executor: `python-agent/agent/executors/nmap_discovery.py`

Executor dedicado a descoberta de portas usando nmap, retornando apenas a lista de portas (mesmo formato do masscan: `{data: {ip, ports}}`).

```text
Comando principal:
  sudo nmap -sS -Pn --open
    -p- (ou --top-ports 10000 para alvos com muitas portas)
    --min-rate 100 --max-rate 500
    -T2
    --scan-delay 200ms
    --max-retries 2
    --data-length 24
    --host-timeout 300s
    -oX -
    <ip>
```

Logica de protecao contra falsos positivos:
- Se mais de 500 portas "open" forem encontradas, reescanear com `--top-ports 1000` (alvo provavelmente e cloud/CDN respondendo em tudo)
- Retornar apenas portas com state "open" (ignorar "filtered" e "closed")

### 2. Atualizar `python-agent/agent/executors/__init__.py`

Registrar o novo `NmapDiscoveryExecutor`.

### 3. Atualizar `python-agent/agent/tasks.py`

Adicionar `nmap_discovery` ao dicionario de executors e ao set `SCAN_EXECUTORS`.

### 4. Atualizar blueprint no banco

```sql
UPDATE device_blueprints
SET collection_steps = jsonb_set(
  collection_steps,
  '{steps,0}',
  '{
    "id": "masscan_discovery",
    "name": "Port Discovery (nmap)",
    "type": "nmap_discovery",
    "params": {"port_range": "1-65535", "max_rate": 500},
    "timeout": 420,
    "description": "Descoberta de portas abertas usando nmap stealth scan"
  }'::jsonb
)
WHERE name = 'Active Attack Surface Scan';
```

Nota: o `id` permanece `masscan_discovery` para manter compatibilidade com o consolidador de resultados na Edge Function `agent-task-result`. Apenas o `type` e `name` mudam.

### 5. Manter o executor masscan (sem remover)

O arquivo `masscan.py` permanece no codigo como fallback, mas nao sera mais referenciado pelo blueprint ativo. Pode ser removido numa limpeza futura.

### 6. Protecao contra "Argument list too long" no httpx

Adicionar um limite de 200 portas no executor httpx. Se `ports` vier do contexto com mais de 200 entradas, usar apenas as portas mais comuns de servicos web (80, 443, 8080, 8443, etc) para evitar o erro de command-line overflow.

## Resultado esperado

```text
Pipeline atualizado:
  Step 1: nmap_discovery (SYN stealth, T2, scan-delay) -> lista de portas
  Step 2: nmap_fingerprint (version detection nas portas descobertas) -> servicos
  Step 3: httpx_webstack (web detection, max 200 portas) -> tecnologias
```
