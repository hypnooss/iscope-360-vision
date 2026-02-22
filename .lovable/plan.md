

# Enriquecer Findings com Dados NSE dos Scripts Nmap

## Contexto

Os scans recentes agora coletam dados ricos dos scripts NSE do Nmap que estao armazenados nos snapshots mas **nao sao aproveitados** pelo motor de findings (`surfaceFindings.ts`). Os scripts disponíveis incluem:

| Script NSE | Dados coletados | Status atual |
|---|---|---|
| `vulners` | CVEs e exploits conhecidos por produto/versao | Ignorado (usa apenas cve_cache) |
| `ssl-enum-ciphers` | Versoes TLS suportadas e cipher suites | Ignorado |
| `http-security-headers` | Headers de seguranca presentes/ausentes (HSTS, X-Content-Type, etc) | Ignorado |
| `ssh2-enum-algos` | Algoritmos de criptografia SSH | Ignorado |
| `http-robots.txt` | Caminhos bloqueados/expostos | Ignorado |
| `http-methods` | Metodos HTTP permitidos (PUT, DELETE, TRACE) | Ignorado |
| `ssl-cert` | Detalhes do certificado (org, CN, validade) | Parcialmente usado (apenas para tech extraction) |
| `smb-os-discovery` | SO detectado via SMB | Parcialmente usado (apenas para tech extraction) |
| `rdp-ntlm-info` | Versao Windows via NTLM | Parcialmente usado (apenas para tech extraction) |
| `http-server-header` | Server header | Parcialmente usado |

## Novas Categorias de Findings

### 1. Seguranca Web (web_security) -- Novos findings via scripts

**a) Headers de Seguranca Ausentes** (severity: medium)
- Fonte: `http-security-headers`
- Detectar ausencia de: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`
- O script ja indica explicitamente "HSTS not configured" e quais headers estao presentes
- Gera 1 finding agrupado por tipo de header ausente com lista dos ativos afetados

**b) Metodos HTTP Perigosos** (severity: medium)
- Fonte: `http-methods`
- Detectar presença de `PUT`, `DELETE`, `TRACE`, `CONNECT` em endpoints publicos
- TRACE permite cross-site tracing (XST), PUT/DELETE permitem manipulação remota

### 2. Criptografia (nova categoria: `crypto_weaknesses`)

**a) Cipher Suites Fracos** (severity: high/medium)
- Fonte: `ssl-enum-ciphers`
- Detectar TLSv1.0, TLSv1.1 (obsoletos)
- Detectar cipher suites com CBC (vulneravel a BEAST/POODLE)
- Detectar cipher suites com RSA key exchange (sem forward secrecy)
- Rating "B" ou "C" no campo `least strength`

**b) Algoritmos SSH Fracos** (severity: medium)
- Fonte: `ssh2-enum-algos`
- Detectar algoritmos obsoletos: `diffie-hellman-group1-sha1`, `diffie-hellman-group14-sha1`, `3des-cbc`, `arcfour`, `hmac-sha1`, `hmac-md5`

### 3. Vulnerabilidades (vulnerabilities) -- Enriquecimento

**Vulners Script** (enriquecimento do matching existente)
- Fonte: `vulners`
- O script retorna CVEs com score CVSS diretamente do scan
- Atualmente o sistema depende apenas do `cve_cache` e matching por produto/versao
- Integrar os CVEs do vulners como fonte adicional, mesclando com os ja detectados

## Mudancas Tecnicas

### 1. `src/lib/surfaceFindings.ts`

**Nova categoria:**
```
crypto_weaknesses: {
  key: 'crypto_weaknesses',
  label: 'Criptografia',
  icon: 'lock',
  color: 'cyan-500',
  colorHex: '#06b6d4',
  description: 'Configuracoes criptograficas fracas ou obsoletas',
}
```

**Novos blocos no `generateFindings()`:**
- Bloco 6: Security Headers (parsear `http-security-headers` de `services[].scripts`)
- Bloco 7: Metodos HTTP perigosos (parsear `http-methods` de `services[].scripts`)
- Bloco 8: TLS/SSL fraco (parsear `ssl-enum-ciphers` de `services[].scripts`)
- Bloco 9: SSH fraco (parsear `ssh2-enum-algos` de `services[].scripts`)
- Enriquecer bloco 3 (CVEs): adicionar CVEs do script `vulners`

**Tipo `FindingsAsset`:**
- O tipo `services[].scripts` ja esta definido como `Record<string, string>` -- nao precisa mudar

### 2. `src/components/surface/CategoryOverviewGrid.tsx` e `CategoryDetailSheet.tsx`

- Adicionar a nova categoria `crypto_weaknesses` nos componentes de visualizacao
- Adicionar icone e cor correspondentes

### 3. `src/components/surface/SurfaceFindingCard.tsx`

- Adicionar cor hover para `cyan-500` no mapa `CATEGORY_HOVER_CLASSES`

### 4. `src/components/surface/SeverityTechDonut.tsx`

- Suportar a nova categoria no grafico donut

### 5. `src/pages/external-domain/AllFindingsPage.tsx`

- Nenhuma mudanca necessaria (usa `generateFindings` que sera atualizado)

## Logica de Parsing dos Scripts

### `http-security-headers`
```text
Input:  "\n  Strict_Transport_Security: \n    HSTS not configured..."
Output: { missing: ['HSTS'], present: ['X-Content-Type-Options'] }
```
Detectar linhas com "not configured" ou ausencia de headers-chave.

### `ssl-enum-ciphers`
```text
Input:  "\n  TLSv1.2: \n    ciphers: \n      TLS_RSA_WITH_AES_128_CBC_SHA..."
Output: { versions: ['TLSv1.2'], hasWeakCiphers: true, hasCBC: true, leastStrength: 'A' }
```
Parsear versoes TLS e identificar cipher suites fracos.

### `ssh2-enum-algos`
```text
Input:  "\n  kex_algorithms: (11)\n      curve25519-sha256\n      ..."
Output: { weakAlgos: ['hmac-sha1', 'diffie-hellman-group14-sha1'] }
```
Verificar presença de algoritmos obsoletos na lista.

### `http-methods`
```text
Input:  "\n  Supported Methods: GET HEAD POST OPTIONS PUT DELETE"
Output: { dangerous: ['PUT', 'DELETE'] }
```
Extrair metodos apos "Supported Methods:" e filtrar perigosos.

### `vulners`
```text
Input:  "\n  nginx 1.18.0: \n    NGINX:CVE-2026-1642\t8.2\thttps://..."
Output: [{ cve_id: 'CVE-2026-1642', score: 8.2, url: '...' }]
```
Parsear linhas com CVE IDs e scores para injetar no matching existente.

## O que NAO muda

- Nenhuma edge function
- Nenhuma tabela do banco
- Nenhum executor do python-agent
- A logica existente de findings (risky_services, web_security HTTP, CVE matching por cve_cache, TLS certs, obsolete_tech) permanece identica
- Os novos findings sao **aditivos** -- somam-se aos existentes

