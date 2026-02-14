

# Fix: Inverter lógica do Nmap - Coleta completa primeiro, fallback conservador

## Problema

A lógica atual do executor Nmap esta invertida:
- O scan **primario** e conservador (sem scripts, version-intensity 5) e coleta poucos dados
- O **fallback** e completo (com scripts banner/ssl-cert/http-title, intensity 7) mas quase nunca executa porque a condicao `if not services` raramente e verdadeira (portas abertas ja populam a lista, mesmo sem fingerprint)

O resultado: servicos HTTPS/TLS ficam sem identificacao (product vazio, sem CPE, sem titulo).

## Correcao

**Arquivo:** `python-agent/agent/executors/nmap.py`

Inverter a ordem: o scan primario deve tentar coletar **todos os dados possiveis** (com scripts e intensity alta). O fallback so executa se o primario falhar (timeout, erro, ou zero resultados).

### Scan Primario (novo)
```
nmap -sS -sV
  --version-intensity 7
  --script=banner,ssl-cert,http-title
  -T3
  --host-timeout 300s
  --scan-delay 500ms
  --max-retries 2
  --data-length 24
```
- Inclui scripts de fingerprinting desde o inicio
- Intensity 7 para maximizar deteccao de versao
- Mantem os parametros stealth (T3, scan-delay, data-length)

### Fallback (novo)
Executa **apenas se nenhum servico com fingerprint foi encontrado** (`not any(s.get('product') or s.get('cpe') for s in services)`):
```
nmap -sS -sV
  --version-intensity 5
  --script=banner
  -T3
  --host-timeout 180s
  --max-retries 1
  --data-length 24
```
- Versao mais leve, apenas script banner
- Timeout e retries reduzidos
- Ultima tentativa antes de desistir

### Condicao do Fallback
Tambem corrige o bug da condicao: em vez de `if not services` (lista vazia), usa `if not has_fingerprint` (nenhum servico com product ou CPE preenchidos).

## Secao Tecnica

**Unico arquivo modificado:** `python-agent/agent/executors/nmap.py`

Alteracoes nas linhas 42-101:

```python
# PRIMARY: full collection with scripts and high intensity
cmd = [
    'sudo', 'nmap', '-sS', '-sV',
    '--version-intensity', '7',
    '--script=banner,ssl-cert,http-title',
    f'-p{port_str}',
    ip,
    '-oX', '-',
    '-T3',
    '--host-timeout', '300s',
    '--scan-delay', '500ms',
    '--max-retries', '2',
    '--data-length', '24',
]

# ... execute and parse ...

# Fallback: if no fingerprint was found, retry with lighter params
has_fingerprint = any(
    s.get('product') or s.get('cpe')
    for s in services
)
if not has_fingerprint and ports:
    self.logger.warning(
        f"[nmap] No fingerprints on {ip} with {len(services)} open ports. "
        f"Retrying with lighter scan..."
    )
    cmd_fallback = [
        'sudo', 'nmap', '-sS', '-sV',
        '--version-intensity', '5',
        '--script=banner',
        f'-p{port_str}',
        ip,
        '-oX', '-',
        '-T3',
        '--host-timeout', '180s',
        '--max-retries', '1',
        '--data-length', '24',
    ]
```

Parametros stealth mantidos em ambas as fases (-T3, --data-length 24, --scan-delay no primario). A mudanca e apenas na **ordem de prioridade**: coleta maxima primeiro, simplificacao depois.
