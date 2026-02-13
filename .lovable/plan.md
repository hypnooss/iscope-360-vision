

# Fix: Matching de CVEs deve considerar versao detectada

## Problema

A funcao `matchCVEsToIP` faz match apenas por **nome do produto** (ex: "nginx"), ignorando a versao. Isso causa:

- IP com nginx **sem versao detectada** (porta 443, CPE `cpe:/a:igor_sysoev:nginx`) recebe **todos** os 20 CVEs de nginx do cache
- IP com nginx **1.28.0** (porta 80) recebe 41 CVEs — incluindo CVEs de versoes que nao se aplicam

## Solucao

Mudar a logica para extrair **pares produto+versao** do IP, e aplicar regras de match:

| Cenario | Regra |
|---|---|
| IP tem produto COM versao (ex: nginx 1.28.0) | Match CVEs do cache cuja versao seja igual OU wildcard (`*`) |
| IP tem produto SEM versao (ex: nginx sem versao) | NAO fazer match com CVEs do cache (incerteza) |
| CVEs do snapshot (`cve_matches`) | Manter logica existente (match por vulnSet + produto) |

## Detalhes tecnicos

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

#### 1. Extrair pares produto+versao (ao inves de apenas produto)

Substituir o `Set<string> products` por um `Map<string, string | null>` onde key = produto e value = versao ou null:

```typescript
// Antes: Set<string> products (so nome)
// Depois: Map<string, string | null> productVersions

const productVersions = new Map<string, string | null>();

// Nmap CPEs: ex "cpe:2.3:a:igor_sysoev:nginx:1.28.0:..."
for (const svc of result.services || []) {
  if (svc.cpe && Array.isArray(svc.cpe)) {
    for (const cpe of svc.cpe) {
      const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':');
      const product = (parts[2] || '').replace(/_/g, ' ').toLowerCase();
      const version = parts[3] && parts[3] !== '*' && parts[3] !== '' 
        ? parts[3] : null;
      if (product) {
        // Se ja tem versao registrada, nao sobrescrever com null
        const existing = productVersions.get(product);
        if (!existing && version) productVersions.set(product, version);
        else if (!existing) productVersions.set(product, null);
      }
    }
  }
  if (svc.product) {
    const p = svc.product.toLowerCase();
    if (!productVersions.has(p)) {
      productVersions.set(p, svc.version || null);
    }
  }
}

// httpx technologies: ex "PHP:8.3.27"
for (const ws of result.web_services || []) {
  for (const tech of ws.technologies || []) {
    const [name, ver] = tech.split(':');
    const techName = name.trim().toLowerCase();
    const techVer = ver?.trim() || null;
    if (techName) {
      const existing = productVersions.get(techName);
      if (!existing && techVer) productVersions.set(techName, techVer);
      else if (!existing) productVersions.set(techName, null);
    }
  }
  if (ws.server) {
    const [name, ver] = ws.server.toLowerCase().split('/');
    const p = name.trim();
    if (p && !productVersions.has(p)) {
      productVersions.set(p, ver?.trim() || null);
    }
  }
}
```

#### 2. Match de snapshot `cve_matches` — manter igual (usa `products` como Set de nomes)

Para o match com `cve_matches` do snapshot, continuar usando apenas nomes de produto (sem filtro de versao), pois esses CVEs ja foram correlacionados durante o scan.

#### 3. Match de `cachedCVEs` — aplicar filtro de versao

```typescript
if (cachedCVEs && productVersions.size > 0) {
  for (const cached of cachedCVEs) {
    if (matched.has(cached.cve_id)) continue;
    const cachedProducts = cached.products || [];
    // products format: [vendor, product, version]
    // ex: ["f5", "nginx", "*"] ou ["php", "php", "8.3.27"]
    const cachedProduct = (cachedProducts[1] || '').toLowerCase();
    const cachedVersion = cachedProducts[2] || '*';

    for (const [product, detectedVersion] of productVersions) {
      if (!cachedProduct.includes(product) && !product.includes(cachedProduct)) continue;
      
      // Se nao detectamos versao, nao vincular CVEs do cache
      if (!detectedVersion) continue;
      
      // Se CVE tem versao wildcard, vincular (generico)
      if (cachedVersion === '*') {
        matched.set(cached.cve_id, { ... });
        break;
      }
      
      // Se CVE tem versao especifica, so vincular se bater
      if (cachedVersion === detectedVersion) {
        matched.set(cached.cve_id, { ... });
        break;
      }
    }
  }
}
```

### Resultado esperado

| IP | Produto detectado | CVEs antes | CVEs depois |
|---|---|---|---|
| 13.225.107.78 | nginx (sem versao) | 20 | 0 (do cache) |
| 187.85.164.49 | nginx 1.28.0 + nginx (sem versao na 443) | 41 | ~20 wildcard + CVEs especificas para 1.28.0 |

