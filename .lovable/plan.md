

# Fix: Salvar versoes afetadas reais no campo `products` do CVE cache

## Problema

Na edge function `refresh-cve-cache`, ao sincronizar CVEs via NVD para web services (funcao `syncNistNvdWebSource`), o campo `products` e salvo com a versao do CPE de **busca**, nao com a versao **afetada** do CVE:

```typescript
// Linha 314 - usa cpeVersion que vem do CPE de busca
const productLabel = `${cpeVendor} ${cpeProduct}${cpeVersion ? ' ' + cpeVersion : ''}`.trim();
```

Quando o CPE de busca tem versao `*` (ex: servidor "nginx" sem versao no header), **todos** os CVEs retornados sao salvos com `"f5 nginx *"`. No frontend, `*` faz match com qualquer IP que tenha nginx com versao detectada, gerando falsos positivos massivos.

## Solucao

Extrair as versoes afetadas do campo `configurations` que o NVD retorna em cada CVE. Cada CVE tem CPE matches com versoes especificas ou ranges. Salvar no `products` a informacao real de versao afetada.

## Detalhes tecnicos

### Arquivo: `supabase/functions/refresh-cve-cache/index.ts`

#### 1. Nova funcao helper: `extractAffectedProducts`

Extrair do campo `configurations` de cada CVE os produtos afetados com versoes especificas:

```typescript
function extractAffectedProducts(
  cveData: any, 
  searchProduct: string
): string[] {
  const results: string[] = [];
  const configs = cveData.configurations || [];
  
  for (const config of configs) {
    for (const node of config.nodes || []) {
      for (const match of node.cpeMatch || []) {
        if (!match.vulnerable) continue;
        
        // Parse CPE: cpe:2.3:a:vendor:product:version:...
        const parts = (match.criteria || '').split(':');
        if (parts.length < 6) continue;
        
        const vendor = (parts[3] || '').replace(/_/g, ' ');
        const product = (parts[4] || '').replace(/_/g, ' ');
        const version = parts[5] || '*';
        
        // Filtrar apenas o produto que estamos buscando
        if (!product.includes(searchProduct) && 
            !searchProduct.includes(product)) continue;
        
        // Se tem range de versoes, criar label com range
        if (match.versionEndExcluding || match.versionEndIncluding) {
          const end = match.versionEndExcluding 
            ? `< ${match.versionEndExcluding}` 
            : `<= ${match.versionEndIncluding}`;
          const start = match.versionStartIncluding 
            ? `>= ${match.versionStartIncluding}` 
            : '';
          results.push(`${vendor} ${product} ${start} ${end}`.replace(/\s+/g, ' ').trim());
        } else if (version !== '*') {
          // Versao exata
          results.push(`${vendor} ${product} ${version}`);
        } else {
          // Wildcard - todas as versoes afetadas
          results.push(`${vendor} ${product} *`);
        }
      }
    }
  }
  
  return results.length > 0 ? results : [`${searchProduct} *`];
}
```

#### 2. Alterar o salvamento na funcao `syncNistNvdWebSource`

Na iteracao dos CVEs retornados (linha ~316-366), substituir a logica de `productLabel`:

```typescript
// ANTES (linha 314):
const productLabel = `${cpeVendor} ${cpeProduct}${cpeVersion ? ' ' + cpeVersion : ''}`.trim();
// ... products: [productLabel]

// DEPOIS:
const affectedProducts = extractAffectedProducts(cveData, cpeProduct);
// ... products: affectedProducts
```

#### 3. Atualizar o matching no frontend

Com as versoes corretas salvas, o frontend precisa iterar sobre **todos os elementos** do array `products` (nao apenas `products[0]`), pois agora pode haver multiplos:

```typescript
// Em matchCVEsToIP, iterar cached.products
for (const productEntry of cached.products) {
  const productStr = typeof productEntry === 'string' ? productEntry : '';
  const parts = productStr.split(' ').filter(Boolean);
  if (parts.length < 2) continue;
  
  // Extrair produto e versao
  // Checar se tem range (>=, <, <=)
  const hasRange = parts.some(p => 
    p.startsWith('>=') || p.startsWith('<') || p.startsWith('<='));
  
  if (hasRange) {
    // Parsing de range para match de versao
    // ...
  } else {
    // Match exato ou wildcard (logica atual)
    const cachedVersion = parts.length >= 3 ? parts[parts.length - 1] : '*';
    const cachedProduct = (parts.length >= 3
      ? parts.slice(1, -1).join(' ')
      : parts[1]
    ).toLowerCase();
    // ... match logic
  }
}
```

#### 4. Funcao de comparacao de versoes

Para suportar ranges (ex: `>= 1.25.0 < 1.27.3`), adicionar uma funcao simples de comparacao de versoes semver:

```typescript
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

function isVersionInRange(
  version: string, 
  range: { gte?: string; lt?: string; lte?: string }
): boolean {
  if (range.gte && compareVersions(version, range.gte) < 0) return false;
  if (range.lt && compareVersions(version, range.lt) >= 0) return false;
  if (range.lte && compareVersions(version, range.lte) > 0) return false;
  return true;
}
```

### Resultado esperado

Exemplo de como o cache ficara apos a correcao:

| CVE | products (antes) | products (depois) |
|---|---|---|
| CVE-2024-7347 | `["f5 nginx *"]` | `["f5 nginx >= 1.25.5 < 1.27.1"]` |
| CVE-2024-3566 | `["php php 8.3.27"]` | `["php php *"]` (todas versoes afetadas) |
| CVE-2023-44487 | `["f5 nginx *"]` | `["f5 nginx >= 1.9.5 < 1.25.3"]` |

Matching no frontend:

| IP | Produto detectado | CVE-2024-7347 (nginx >= 1.25.5 < 1.27.1) | CVE-2023-44487 (nginx >= 1.9.5 < 1.25.3) |
|---|---|---|---|
| 187.85.164.49 (nginx 1.28.0) | nginx 1.28.0 | Nao (1.28.0 >= 1.27.1) | Nao (1.28.0 >= 1.25.3) |
| IP com nginx 1.26.0 | nginx 1.26.0 | Sim (1.25.5 <= 1.26.0 < 1.27.1) | Nao (1.26.0 >= 1.25.3) |
| IP com nginx 1.20.0 | nginx 1.20.0 | Nao (1.20.0 < 1.25.5) | Sim (1.9.5 <= 1.20.0 < 1.25.3) |

### Arquivos modificados

1. `supabase/functions/refresh-cve-cache/index.ts` - Extrair versoes afetadas reais do NVD
2. `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` - Suportar ranges de versao no matching

### Apos deploy

Sera necessario re-sincronizar as fontes de CVE do modulo `external_domain` para que o cache seja atualizado com as versoes corretas. Isso pode ser feito pela pagina Administracao > CVEs > Gerenciar Fontes.

