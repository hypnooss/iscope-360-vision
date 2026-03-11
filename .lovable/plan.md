

## Problema: Correlação de CVEs incorreta no Surface Analyzer

### Diagnóstico

O CPE segue o formato `cpe:2.3:a:vendor:product:version:...`. A correlação atual extrai apenas o **product** (índice 2) e ignora o **vendor** (índice 1).

Exemplo real:
- CPE do IIS: `cpe:2.3:a:microsoft:internet_information_services:10.0:...`
- Extrai: `"internet information services"` → busca `ilike '%internet information services%'` → OK neste caso
- Mas CPEs genéricos como `cpe:/a:apache:http_server` e `cpe:/a:microsoft:http_server` ambos extraem `"http server"` → busca `ilike '%http server%'` → retorna CVEs do Apache para um servidor IIS

O mesmo problema existe em **dois arquivos**:

1. **`supabase/functions/consolidate-attack-surface/index.ts`** (linhas 117-128): extrai só `parts[2]` (product) e faz `ilike('title', '%product%')` sem filtrar por vendor
2. **`supabase/functions/attack-surface-scan/index.ts`** (linhas 681-706): extrai só `parts[2]` e faz matching por substring no title/products

### Solução

Extrair **vendor + product** do CPE e usar ambos na correlação:

**1. `consolidate-attack-surface/index.ts`** — Alterar a extração de CPEs para incluir vendor e usar ambos na query:
```ts
const entries = allCPEs.map((cpe: string) => {
  const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':');
  const vendor = (parts[1] || '').replace(/_/g, ' ').toLowerCase();
  const product = (parts[2] || '').replace(/_/g, ' ').toLowerCase();
  return { vendor, product };
}).filter(e => e.product.length > 2);
```
Na query, buscar CVEs que contenham **ambos** vendor e product no título (ou usar `.ilike('title', '%vendor%product%')` combinado), ou melhor, buscar pelo product e filtrar localmente pelo vendor:
```ts
for (const entry of uniqueEntries) {
  const { data: cves } = await supabase
    .from('cve_cache')
    .select('cve_id, title, severity, score, advisory_url, products')
    .ilike('title', `%${entry.product}%`)
    .order('score', { ascending: false })
    .limit(20);

  if (cves) {
    for (const cve of cves) {
      const titleLower = (cve.title || '').toLowerCase();
      // Só incluir se o título também menciona o vendor OU se products contém o vendor
      const vendorMatch = titleLower.includes(entry.vendor) || 
        (cve.products || []).some(p => String(p).toLowerCase().includes(entry.vendor));
      if (vendorMatch && !cveMatches.find(c => c.cve_id === cve.cve_id)) {
        cveMatches.push(cve);
      }
    }
  }
}
```

**2. `attack-surface-scan/index.ts`** — Mesma lógica: extrair vendor+product dos CPEs (linhas 678-686) e no matching (linhas 696-707) exigir que o vendor também esteja presente no título ou products do CVE.

### Arquivos a modificar
- `supabase/functions/consolidate-attack-surface/index.ts`
- `supabase/functions/attack-surface-scan/index.ts`

Ambas edge functions precisarão de deploy após a alteração.

