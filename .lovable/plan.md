

# Fix: ASN Classifier sem dependencia do binario `whois`

## Problema

O binario `whois` nao esta instalado no servidor do Super Agent. O fallback atual (`FileNotFoundError`) resulta em `is_cdn=False` para todos os IPs, anulando toda a logica cloud-aware.

## Solucao

Substituir `subprocess.run(['whois', ...])` por uma consulta direta ao protocolo WHOIS via **socket TCP na porta 43**. Isso usa apenas a stdlib do Python (`socket`), sem dependencias externas e sem necessidade de instalar pacotes no sistema operacional.

O protocolo WHOIS e extremamente simples:
1. Conectar no servidor WHOIS (ex: `whois.arin.net`) na porta 43
2. Enviar o IP seguido de `\r\n`
3. Ler toda a resposta (texto puro)
4. Fechar a conexao

## Detalhes da Implementacao

### Arquivo: `python-agent/agent/executors/asn_classifier.py`

**Substituir** o metodo `_whois_lookup` que usa `subprocess.run(['whois', ip])` por `_whois_socket_lookup` que faz a consulta via socket direto.

Logica do novo metodo:

```text
1. Abrir socket TCP para whois.arin.net:43 (ARIN cobre todos os IPs, redireciona para RIR correto)
2. Enviar "n {ip}\r\n" (prefixo "n " para forcar lookup de rede no ARIN)
3. Ler resposta completa (max 64KB)
4. Se a resposta indicar outro RIR (ex: "ReferralServer: whois.ripe.net"), seguir o referral
5. Aplicar a mesma extracao de campos e matching de provider que ja existe
```

Fallback para servidores WHOIS por regiao:
- ARIN (Americas): `whois.arin.net` - servidor primario
- RIPE (Europa/Oriente Medio): `whois.ripe.net`
- APNIC (Asia-Pacifico): `whois.apnic.net`

**Mudancas especificas no codigo:**

1. Remover `import subprocess`
2. Adicionar `import socket`
3. Substituir `_whois_lookup` por nova implementacao com socket
4. Adicionar metodo auxiliar `_query_whois_server(server, query, timeout)` para a conexao TCP
5. Adicionar logica de referral (seguir redirecionamento para RIR correto)
6. Manter `_extract_field`, `_match_provider` **inalterados** - o formato da resposta e identico ao do binario `whois`

### Nenhum outro arquivo alterado

- `requirements.txt`: sem mudancas (socket e stdlib)
- `nmap_discovery.py`: sem mudancas
- `httpx_executor.py`: sem mudancas
- `tasks.py` / `__init__.py`: sem mudancas

## Vantagens da abordagem socket vs alternativas

| Abordagem | Pro | Contra |
|---|---|---|
| **Socket TCP (escolhida)** | Zero dependencias, funciona em qualquer servidor, rapido (~1-3s) | Precisa tratar referrals manualmente |
| Instalar binario `whois` | Simples | Requer `apt-get install whois` no servidor, nao portavel |
| API RDAP (HTTP) | JSON estruturado | Rate limiting agressivo, requer `requests`, mais lento |
| `ipwhois` (pip) | API Python limpa | Nova dependencia, aumenta superficie |

## Tratamento de erros

- Socket timeout: retorna `(None, None, None)` -> fallback para scan normal
- Conexao recusada: tenta proximo servidor na lista
- Resposta vazia: fallback para scan normal
- Qualquer excecao: log warning + fallback gracioso (comportamento identico ao atual)

