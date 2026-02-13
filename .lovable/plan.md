

# Fix: Sincronizacao de CVEs para tecnologias web + novas fontes

## Problema identificado

Os logs revelam o bug:

```
[Nginx] NVD API returned 404 for CPE cpe:2.3:a:f5:nginx:*:*:*:*:*:*:*:*
```

A API do NVD **nao aceita wildcards** (`*`) no parametro `cpeName`. O codigo atual so usa `keywordSearch` quando o vendor e `*`, mas para Nginx o vendor e `f5` (conhecido), entao tenta `cpeName` com versao `*` e recebe 404.

O mesmo problema afeta History: como tem vendor `browserstate`, tambem cai no caminho `cpeName` com wildcard.

## Solucao

### 1. Corrigir logica de busca NVD

Mudar a condicao: usar `keywordSearch` sempre que a **versao** for `*` (independente do vendor), e usar `cpeName` apenas para CPEs com versao especifica.

```
Logica atual (bugada):
  - vendor = '*' → keywordSearch
  - vendor != '*' → cpeName (mas versao pode ser *, causando 404)

Logica corrigida:
  - versao = '*' → keywordSearch com "{vendor} {product}" ou apenas "{product}"
  - versao especifica → cpeName (busca exata, funciona corretamente)
```

### 2. Adicionar 4 novas fontes de CVE

Baseado na analise dos snapshots, as seguintes tecnologias foram detectadas em clientes reais e nao possuem fontes configuradas:

| Fonte | module_code | product_filter | Justificativa |
|---|---|---|---|
| PHP | external_domain | php | Detectado em multiplos clientes (7.4.30, 8.3.27, 8.3.15, etc.) |
| OpenSSL | external_domain | openssl | Detectado em multiplos clientes (1.1.1k) - critico para seguranca |
| jQuery | external_domain | jquery | Detectado em multiplos clientes - historico de XSS |
| Node.js | external_domain | node.js | Detectado em 1 cliente - runtime critico |

### Detalhes tecnicos

#### Correcao no `refresh-cve-cache/index.ts`

Substituir o bloco de decisao `cpeName` vs `keywordSearch` (linhas ~275-286):

```typescript
// ANTES (bugado):
const isSyntheticWildcard = cpe23.startsWith('cpe:2.3:a:*:');
if (isSyntheticWildcard) { ... keywordSearch ... }
else { ... cpeName ... }

// DEPOIS (corrigido):
const cpeParts = cpe23.split(':');
const cpeVendorPart = cpeParts[3] || '*';
const cpeProductPart = cpeParts[4] || '';
const cpeVersionPart = cpeParts[5] || '*';

if (cpeVersionPart === '*') {
  // Versao wildcard: NVD nao aceita cpeName com *, usar keywordSearch
  const keyword = cpeVendorPart !== '*' 
    ? `${cpeProductPart}` 
    : cpeProductPart;
  nvdUrl.searchParams.set('keywordSearch', keyword);
  nvdUrl.searchParams.set('keywordExactMatch', '');
} else {
  // Versao especifica: cpeName funciona
  nvdUrl.searchParams.set('cpeName', cpe23);
}
```

#### Mapa de vendors: adicionar novas entradas

```typescript
const KNOWN_VENDORS: Record<string, string> = {
  nginx: 'f5',
  apache: 'apache',
  openssh: 'openbsd',
  history: 'browserstate',
  react: 'facebook',
  lazysizes: 'afarkas',
  jquery: 'jquery',
  php: 'php',
  openssl: 'openssl',
  'node.js': 'nodejs',
  express: 'expressjs',
  nextcloud: 'nextcloud',
};
```

#### Migracao SQL: inserir novas fontes

```sql
INSERT INTO cve_sources (module_code, source_type, source_label, config, is_active) VALUES
  ('external_domain', 'nist_nvd_web', 'PHP', '{"product_filter": "php"}', true),
  ('external_domain', 'nist_nvd_web', 'OpenSSL', '{"product_filter": "openssl"}', true),
  ('external_domain', 'nist_nvd_web', 'jQuery', '{"product_filter": "jquery"}', true),
  ('external_domain', 'nist_nvd_web', 'Node.js', '{"product_filter": "node.js"}', true);
```

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/refresh-cve-cache/index.ts` | Corrigir logica cpeName vs keywordSearch; atualizar KNOWN_VENDORS |
| Migracao SQL | Inserir 4 novas fontes (PHP, OpenSSL, jQuery, Node.js) |

