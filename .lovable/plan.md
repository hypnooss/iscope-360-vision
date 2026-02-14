

# Refatorar Attack Surface Analyzer - Visao Asset-Centric

## Resumo

Reescrever completamente a pagina `AttackSurfaceAnalyzerPage.tsx`, eliminando as secoes separadas de Web Services, Certificados TLS e Inventario de IPs. Toda informacao sera reorganizada em torno de **Ativos Expostos** (hostname + IP), com progressive disclosure via cards expansiveis.

## Estrutura Atual vs Nova

```text
ATUAL (Data-Centric)              NOVO (Asset-Centric)
========================           ========================
Port Heatmap | Tech Stack         Header Executivo (4 cards)
Web Services Table                 Barra de Busca + Ordenacao
TLS Certificates Table             Lista de Ativos (cards)
IP Inventory Table                   -> Card resumido por ativo
                                     -> Expandido: Portas, Servicos,
                                        TLS, CVEs (tudo contextual)
```

## Alteracoes

### Arquivo Unico: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Reescrita completa da pagina. Os hooks (`useClientId`, `useAttackSurfaceProgress`) e a logica de CVE matching (`matchCVEsToIP`, `compareVersions`, `isVersionInRange`) sao mantidos intactos. Apenas a camada de apresentacao muda.

---

### 1. Novo modelo de dados: `ExposedAsset`

Funcao `buildAssets(snapshot, cachedCVEs)` que transforma o snapshot em uma lista de ativos:

| Campo | Origem |
|---|---|
| `hostname` | `source_ips[].label` ou `results[ip].hostnames[0]` ou IP como fallback |
| `ip` | Chave do `results` |
| `ports` | `results[ip].ports` |
| `services` | `results[ip].services` (nmap) |
| `webServices` | `results[ip].web_services` (httpx) |
| `tlsCerts` | Extraidos de `web_services[].tls` (deduplicados por CN+expiry) |
| `cves` | `matchCVEsToIP(result, cveMatches, cachedCVEs)` |
| `riskScore` | Calculado: soma ponderada de CVEs por severidade |
| `expiredCerts` | Count de certificados com `daysRemaining < 0` |

A lista e ordenada por `riskScore` descendente (ativos mais criticos primeiro).

**Calculo do Risk Score**:
- Critical CVE = 10 pontos
- High CVE = 7 pontos
- Medium CVE = 4 pontos
- Low CVE = 1 ponto
- Certificado expirado = +5 pontos
- Certificado expirando (<30d) = +2 pontos

---

### 2. Header Executivo - 4 Stat Cards

Cards compactos e inline (mesmo padrao visual das outras paginas de gerenciamento):

| Card | Valor | Icone |
|---|---|---|
| Ativos Expostos | Total de ativos unicos | `Globe` |
| Servicos Detectados | Total de servicos (nmap + httpx) | `Server` |
| CVEs Criticas | Total de CVEs com severity=critical | `ShieldAlert` |
| Certificados Expirados | Total de certs com `daysRemaining < 0` | `AlertTriangle` |

Remover o Score Gauge (card rabiscado de vermelho na imagem).

---

### 3. Barra de Busca + Ordenacao

- Input de busca filtrando por hostname, IP ou tecnologia
- Dropdown de ordenacao: "Maior Risco", "Mais CVEs", "Mais Portas", "Alfabetico"

---

### 4. Lista de Ativos - Card Resumido

Cada ativo renderiza um card com:

```text
+----------------------------------------------------------+
| [Globe] api.example.com                                   |
|         164.152.53.244                                     |
|                                                            |
|  3 portas abertas  |  Apache/2.4.37  Express  NodeJS  ... |
|                                                            |
|  [HIGH]  |  1 CRITICAL  2 HIGH  |  Cert: Expirado ha 68d  |
+----------------------------------------------------------+
```

**Detalhes visuais:**
- Icone `Globe` com cor baseada no risco (teal=baixo, amber=medio, red=alto/critico)
- Hostname em `text-base font-semibold`
- IP em `text-sm text-muted-foreground font-mono`
- Tecnologias como badges compactos (max 4 visiveis + overflow)
- Risk badge: `LOW` (teal), `MEDIUM` (amber), `HIGH` (orange), `CRITICAL` (red)
- CVE summary como badges por severidade
- Status do certificado com cor contextual
- Chevron para expandir

---

### 5. Card Expandido - Progressive Disclosure

Ao clicar, o card expande e mostra 4 blocos:

#### Bloco 1: Portas Abertas
Lista simples de badges com numeros de porta (reuso do visual existente).

#### Bloco 2: Servicos e Tecnologias
Mini-tabela ou lista:
- Produto | Versao | Porta | Banner (para servicos nmap)
- URL | Status HTTP | Servidor | Tecnologias (para web services)

#### Bloco 3: Certificado TLS
Card compacto (nao tabela):
- CN, Issuer, Data de expiracao, Dias restantes
- Status visual: badge verde "Valido", badge amarelo "Expira em Xd", badge vermelho "Expirado ha Xd"

#### Bloco 4: Vulnerabilidades
Lista de CVEs ordenadas por score CVSS descendente:
- Badge de severidade | CVE ID | Score | Titulo | Link externo

---

### 6. Componentes Removidos

Os seguintes componentes internos serao removidos pois seus dados estarao contextualizados dentro de cada ativo:

- `PortHeatmap` - portas ficam dentro de cada ativo
- `TechStackSection` - tecnologias ficam dentro de cada ativo
- `WebServicesSection` - web services ficam dentro de cada ativo
- `TLSCertificatesSection` - certs ficam dentro de cada ativo
- `IPDetailRow` - substituido pelo novo card de ativo

### 7. Componentes Mantidos

- `SeverityBadge` - reutilizado nos CVEs
- `getTechBadgeColor` - reutilizado nas tecnologias
- `matchCVEsToIP` e funcoes auxiliares de versao - logica core mantida
- `useClientId`, `useAttackSurfaceProgress` - hooks mantidos
- Logica de workspace selector e scan controls - mantida

---

## Resumo de Impacto

| Item | Status |
|---|---|
| Arquivo alterado | 1 (`AttackSurfaceAnalyzerPage.tsx`) |
| Hook de dados | Sem alteracao |
| Tipos | Sem alteracao |
| Edge Function | Sem alteracao |
| Logica de CVE matching | Mantida intacta |
| Secoes separadas (WebServices, TLS, Ports, Tech) | Removidas |
| Nova abstração `ExposedAsset` | Criada como `useMemo` |

