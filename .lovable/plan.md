
# Fix: Parsing do campo `products` do CVE cache

## Problema raiz

O campo `products` no `cve_cache` armazena os dados como **um unico string separado por espacos dentro de um array**:
- `["f5 nginx *"]` (vendor=f5, product=nginx, version=*)
- `["php php 8.3.27"]` (vendor=php, product=php, version=8.3.27)
- `["apache http server 2.4.37"]` (vendor=apache, product=http server, version=2.4.37)

O codigo atual assume que sao 3 elementos separados no array (`products[0]=vendor`, `products[1]=product`, `products[2]=version`), mas na verdade `products[0]` e o string completo e `products[1]` e `undefined`. Isso faz `cachedProduct = ""`, e o `if (!cachedProduct) continue` **pula todos os CVEs**.

## Solucao

Corrigir o parsing em `matchCVEsToIP` para extrair vendor, product e version do string em `products[0]`.

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Substituir o bloco de parsing (linhas 642-647):

```typescript
// ANTES (incorreto):
const cachedProducts = cached.products || [];
const cachedProduct = (typeof cachedProducts[1] === 'string' ? cachedProducts[1] : '').toLowerCase();
const cachedVersion = typeof cachedProducts[2] === 'string' ? cachedProducts[2] : '*';

// DEPOIS (correto):
const cachedProducts = cached.products || [];
const productStr = typeof cachedProducts[0] === 'string' ? cachedProducts[0] : '';
const parts = productStr.split(' ').filter(Boolean);
if (parts.length < 2) continue;
// Format: "vendor product version" ou "vendor product1 product2 version"
// Ultimo token = version, primeiro = vendor, meio = product
const cachedVersion = parts.length >= 3 ? parts[parts.length - 1] : '*';
const cachedProduct = (parts.length >= 3
  ? parts.slice(1, -1).join(' ')
  : parts[1]
).toLowerCase();
```

Exemplos de parsing:

| products[0] | vendor | cachedProduct | cachedVersion |
|---|---|---|---|
| `"f5 nginx *"` | f5 | nginx | * |
| `"php php 8.3.27"` | php | php | 8.3.27 |
| `"apache http server 2.4.37"` | apache | http server | 2.4.37 |
| `"openbsd openssh 9.6p1"` | openbsd | openssh | 9.6p1 |

### Resultado esperado

| IP | Produto detectado | CVEs antes | CVEs depois |
|---|---|---|---|
| 187.85.164.49 (nginx 1.28.0 + PHP 8.3.27) | nginx, php | 0 | CVEs nginx wildcard + CVE-2024-3566 (PHP 8.3.27) |
| IPs sem versao detectada | nginx (sem versao) | 0 | 0 (correto - sem versao = sem match) |
