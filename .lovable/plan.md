
# Estrategia: CVE Cache Independente de Versao Detectada

## Problema Atual (Deadlock)

O ciclo atual e circular: precisa de uma analise para detectar a versao, para sincronizar CVEs, para apresentar dados. Na primeira vez que um software aparece, nao ha CVEs no cache.

## Nova Estrategia

Sincronizar **todas as CVEs** de cada produto monitorado, independente de versao detectada. O matching de versao acontece apenas no **frontend** (que ja faz isso via semver).

## Volume de Dados Estimado

| Produto | CVEs estimadas | Tamanho |
|---|---|---|
| FortiOS | ~1.000 | ~5 MB |
| SonicOS | ~200 | ~1 MB |
| Nginx | ~350 | ~1.7 MB |
| OpenSSH | ~300 | ~1.5 MB |
| OpenSSL | ~450 | ~2.2 MB |
| PHP | ~1.800 | ~9 MB |
| Apache HTTP | ~600 | ~3 MB |
| Node.js | ~250 | ~1.2 MB |
| jQuery | ~40 | ~0.2 MB |
| Exim | ~65 | ~0.3 MB |
| M365 (MSRC) | ~150 | ~0.7 MB |
| **Total** | **~5.200** | **~26 MB** |

Isso e perfeitamente viavel. Hoje temos 329 CVEs / 1.8 MB.

## Mudancas Tecnicas

### 1. Edge Function `refresh-cve-cache/index.ts`

**`syncNistNvdSource` (Firewall - FortiOS/SonicOS):**
- Remover a dependencia de `analysis_history` e `firewalls` para extrair versoes
- Passar a buscar CVEs diretamente via `keywordSearch` para o produto (ex: "FortiOS", "SonicOS")
- Usar paginacao do NVD (`startIndex` + `resultsPerPage`) para capturar todas as CVEs
- Manter o filtro por `months` da config como opcional (se configurado, adicionar `pubStartDate`/`pubEndDate`)
- Se `months` nao estiver na config, sincronizar tudo

**`syncNistNvdWebSource` (Dominio Externo - Nginx, PHP, etc.):**
- Remover a dependencia de `attack_surface_snapshots` para extrair CPEs
- Para cada source ativa, buscar diretamente via `keywordSearch` pelo `product_filter` (ex: "nginx", "php")
- Usar paginacao para capturar todas as CVEs do produto
- Continuar extraindo `products` com version ranges reais do campo `configurations` do NVD (funcao `extractAffectedProducts` ja existe)

**`syncMsrcSource` (M365):**
- Sem mudancas - ja e independente de ativos detectados

### 2. Tabela `cve_sources` - Ajuste de Config

Atualizar as configs das fontes existentes para refletir a nova estrategia:

- Fontes de firewall: remover limitacao de `months: 6`, ou aumentar para `months: 24` (compromisso entre cobertura e volume)
- Fontes web: nenhum campo novo necessario, o `product_filter` ja serve como chave de busca

### 3. Logica de Paginacao NVD

Adicionar funcao auxiliar `fetchAllNvdPages` que:
1. Faz a primeira request com `startIndex=0` e `resultsPerPage=100` (maximo permitido)
2. Le `totalResults` da resposta
3. Itera com `startIndex` incrementando de 100 ate cobrir tudo
4. Respeita rate limit (6.5s entre requests)
5. Retorna array consolidado de todas as vulnerabilidades

### 4. Nenhuma mudanca no Frontend

O frontend ja faz matching semver correto entre versao detectada e ranges do campo `products`. Com mais CVEs no cache, o matching funcionara imediatamente na primeira deteccao de qualquer versao.

### 5. Tempo de Sync Estimado

- ~12 produtos x ~5-15 paginas cada = ~60-180 requests
- Rate limit: 6.5s/request = **~6-20 minutos** total
- Executado diariamente pelo CRON, tempo aceitavel
