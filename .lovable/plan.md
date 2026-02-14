

# Cloud-Aware Port Discovery - Arquitetura Hibrida

## Problema

IPs de CDN/Cloud (Cloudflare, Azure, Akamai, Fastly) bloqueiam SYN scans silenciosamente, resultando em 0 portas encontradas. Esses provedores exigem TLS handshake valido com SNI correto e headers HTTP realistas.

## Arquitetura Proposta

O pipeline atual tem 3 steps sequenciais: `nmap_discovery` -> `nmap` (fingerprint) -> `httpx`. A proposta adiciona uma **Fase 0 de classificacao** e bifurca a estrategia.

```text
                    +-------------------+
                    |  ASN Classifier   |  (nova Fase 0)
                    |  (IP -> provider) |
                    +--------+----------+
                             |
                +------------+------------+
                |                         |
          NAO-CDN / Infra             CDN / Cloud Edge
                |                         |
     +----------+----------+    +---------+---------+
     | nmap_discovery       |    | nmap_discovery    |
     | SYN full (1-65535)   |    | --top-ports 1000  |
     | -T2, max_rate=500    |    | -T2, max_rate=300 |
     +----------+----------+    +---------+---------+
                |                         |
     +----------+----------+    +---------+---------+
     | nmap (fingerprint)   |    | nmap (fingerprint)|
     | version + scripts    |    | version + scripts |
     +----------+----------+    +---------+---------+
                |                         |
     +----------+----------+    +---------+---------+
     | httpx (web probe)    |    | httpx (web probe) |
     |                      |    | + browser headers |
     +----------+----------+    | + SNI correto      |
                |               +---------+---------+
                |                         |
                +------------+------------+
                             |
                    +--------+----------+
                    |  Resultado Final  |
                    |  (normalizado)    |
                    +-------------------+
```

## Detalhes de Implementacao

### 1. Novo Executor: `asn_classifier.py`

Novo arquivo: `python-agent/agent/executors/asn_classifier.py`

Responsabilidade: Identificar o provedor/ASN de um IP **antes** do port scan.

Abordagem (sem dependencia externa):
- Usar o comando `whois` do sistema (ja disponivel no servidor) para lookup do IP
- Extrair campos `OrgName`, `org-name`, `descr`, `netname` do output
- Matching por keywords contra uma lista de provedores conhecidos:

```text
CDN_PROVIDERS = {
    'cloudflare': ['cloudflare'],
    'akamai': ['akamai'],
    'fastly': ['fastly'],
    'aws_cloudfront': ['amazon', 'cloudfront', 'aws'],
    'azure_cdn': ['microsoft', 'azure'],
    'google_cloud': ['google'],
    'incapsula': ['incapsula', 'imperva'],
    'sucuri': ['sucuri'],
    'stackpath': ['stackpath', 'highwinds'],
    'cloudfront': ['cloudfront'],
}
```

Output do executor:
```python
{
    'data': {
        'ip': '104.26.7.202',
        'is_cdn': True,
        'provider': 'cloudflare',
        'asn': 'AS13335',
        'org': 'Cloudflare, Inc.',
    }
}
```

Esse resultado e propagado no contexto para os steps seguintes usarem.

Dependencias: **Nenhuma nova**. Usa `subprocess` + `whois` (binario do sistema).

### 2. Modificar `nmap_discovery.py` - Cloud-Aware

Alterar o executor existente para ler `context.get('is_cdn')` e ajustar automaticamente:

- **Se `is_cdn == True`:**
  - Usar `--top-ports 1000` em vez de `1-65535`
  - Reduzir `max_rate` para 300
  - Manter todos os parametros stealth
  - Log explicativo: `[nmap_discovery] CDN detected (cloudflare), using top-1000 strategy`

- **Se `is_cdn == False` (ou ausente):**
  - Comportamento atual: full range 1-65535, max_rate 500

Mudanca minima: ~15 linhas no metodo `run()`.

### 3. Modificar `httpx_executor.py` - Browser Simulation

Alterar para adicionar headers realistas quando o contexto indica CDN:

- **Se `context.get('is_cdn')`:**
  - Adicionar ao comando httpx: `-H 'User-Agent: Mozilla/5.0 ...'` com UA de Chrome moderno
  - Adicionar: `-H 'Accept: text/html,...'`
  - Adicionar: `-H 'Accept-Language: en-US,en;q=0.9'`
  - Adicionar: `-H 'Upgrade-Insecure-Requests: 1'`
  - Garantir que o hostname (ja implementado) e usado como target para SNI correto

- **Se nao-CDN:** comportamento atual (sem headers extras)

Mudanca minima: ~20 linhas no metodo `run()`.

### 4. Registrar novo executor em `tasks.py` e `__init__.py`

- `__init__.py`: Adicionar import de `AsnClassifierExecutor`
- `tasks.py`: Adicionar `'asn_classifier': AsnClassifierExecutor(logger)` no dict `_executors`
- Adicionar `'asn_classifier'` ao set `SCAN_EXECUTORS` (nao deve acionar fail-fast)

### 5. Atualizar Blueprint no banco

O blueprint do Attack Surface precisa incluir o step de ASN como **Step 0** antes do nmap_discovery. Isso e feito via SQL na tabela de blueprints (nao requer mudanca de codigo):

```text
Step 0: asn_classifier  (params: {ip})     -> context: {is_cdn, provider, asn}
Step 1: nmap_discovery   (params: {ip})     -> context: {ports}
Step 2: nmap             (params: {ip})     -> context: {services}
Step 3: httpx            (params: {ip})     -> context: {web_services}
```

### 6. `requirements.txt` - Sem alteracoes

Nenhuma biblioteca nova necessaria. Tudo e resolvido com `subprocess` + `whois`.

## Resumo dos Arquivos

| Arquivo | Acao |
|---|---|
| `python-agent/agent/executors/asn_classifier.py` | **Criar** - novo executor ASN lookup |
| `python-agent/agent/executors/nmap_discovery.py` | **Editar** - ajustar estrategia baseada em `is_cdn` |
| `python-agent/agent/executors/httpx_executor.py` | **Editar** - adicionar browser headers para CDN |
| `python-agent/agent/executors/__init__.py` | **Editar** - registrar novo executor |
| `python-agent/agent/tasks.py` | **Editar** - registrar executor + SCAN_EXECUTORS |
| Blueprint (banco) | **SQL** - adicionar step 0 asn_classifier |

## Mitigacao de False Negatives

1. **ASN fallback**: Se `whois` falhar (timeout/indisponivel), assume `is_cdn = False` e prossegue com scan normal
2. **Protecao ghost ports**: Ja existente no nmap_discovery (threshold 500)
3. **httpx como validador**: Mesmo que nmap retorne 0 portas, o httpx com hostname ja proba portas padrao (80, 443, 8080, 8443) com SNI correto - isso funciona mesmo em CDNs que bloqueiam SYN
4. **Browser headers**: Evitam fingerprint de scanner em WAFs como Cloudflare

## Impacto na Performance

- ASN lookup via whois: ~1-3 segundos por IP (paralelo com outros IPs)
- CDN scan (top-1000): ~2-4 minutos vs ~10 minutos do full-range
- Sem impacto em IPs nao-CDN (comportamento identico ao atual)

