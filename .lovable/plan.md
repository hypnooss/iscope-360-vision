
# Sincronizar CVEs de Serviços Web no Cache Local

## Contexto

Atualmente o cache de CVEs possui apenas duas fontes:
- **NIST NVD - Firewalls**: CVEs para FortiOS/SonicOS baseado nas versoes de firmware
- **MSRC**: CVEs para servicos Microsoft 365

O Attack Surface Scanner detecta servicos web com CPEs (ex: `cpe:2.3:a:apache:http_server:2.4.51`) e tecnologias (Nginx, OpenSSH, etc.), mas nao existe nenhuma fonte de CVE que cubra esses produtos. A funcao `correlateCVEs` so faz match por IDs diretos de vulns (que o nmap raramente retorna), resultando em 0 CVEs na coluna.

## Solucao

Criar uma nova fonte de CVE (`web_services`) que extrai CPEs unicos dos snapshots do Attack Surface e sincroniza CVEs do NIST NVD para esses produtos.

### Fluxo

```text
attack_surface_snapshots (results)
        |
        v
  Extrair CPEs unicos de todos os IPs/servicos
        |
        v
  Para cada CPE: consultar NVD API (cpeName=...)
        |
        v
  Upsert resultados em cve_cache (module_code='external_domain')
        |
        v
  Atualizar cve_severity_cache
```

## Alteracoes

### 1. Inserir nova fonte na tabela `cve_sources`

Criar um registro com:
- `module_code`: `external_domain`
- `source_type`: `nist_nvd_web`
- `source_label`: `NIST NVD - Servicos Web`
- `is_active`: `true`

### 2. Atualizar `supabase/functions/refresh-cve-cache/index.ts`

Adicionar handler para o novo `source_type = 'nist_nvd_web'`:

- **Extrair CPEs**: Ler os snapshots completados de `attack_surface_snapshots`, iterar os `results` de cada IP, coletar todos os CPEs unicos dos servicos (campo `services[].cpe[]`)
- **Consultar NVD**: Para cada CPE unico, fazer query ao NVD API com `cpeName=<cpe>` (mesmo padrao usado pelo `fortigate-cve`)
- **Parsear resultados**: Extrair CVE ID, score CVSS, severidade, descricao, data de publicacao
- **Upsert em `cve_cache`**: Com `module_code='external_domain'` e `source_id` da nova fonte
- **Rate limiting**: Respeitar 6.5s entre requests ao NVD (sem API key)
- **Atualizar `cve_severity_cache`**: Contagens por severidade para o modulo `external_domain`

### 3. Atualizar `supabase/functions/attack-surface-scan/index.ts` - `correlateCVEs`

Expandir a correlacao para tambem buscar por CPE product name (alem de vuln IDs diretos):

- Extrair nomes de produto dos CPEs de cada IP enriquecido
- Buscar no `cve_cache` onde `module_code='external_domain'` e o campo `products` contem o nome do produto
- Unir com os matches existentes por vuln ID

### 4. Atualizar UI - `CVESourcesConfigDialog` e `CVEsCachePage`

- Adicionar label `external_domain` ao mapa `MODULE_LABELS` e `MODULE_COLORS` em ambos os arquivos
- Adicionar opcao de filtro "Dominio Externo" no select de modulos da pagina de CVEs

## Detalhes Tecnicos

### Extracao de CPEs dos snapshots

```typescript
// Ler snapshots completados
const { data: snapshots } = await supabase
  .from('attack_surface_snapshots')
  .select('results')
  .eq('status', 'completed')
  .order('created_at', { ascending: false })
  .limit(10);

// Extrair CPEs unicos
const cpeSet = new Set<string>();
for (const snap of snapshots) {
  for (const [ip, result] of Object.entries(snap.results)) {
    for (const svc of result.services || []) {
      for (const cpe of svc.cpe || []) {
        if (cpe.includes(':a:')) cpeSet.add(cpe); // apenas aplicacoes
      }
    }
  }
}
```

### Query ao NVD por CPE

```typescript
const nvdUrl = new URL('https://services.nvd.nist.gov/rest/json/cves/2.0');
nvdUrl.searchParams.set('cpeName', cpe);
nvdUrl.searchParams.set('resultsPerPage', '20');
const resp = await fetch(nvdUrl.toString());
```

### Correlacao expandida no attack-surface-scan

```typescript
async function correlateCVEs(enrichedResults, supabase) {
  // Matching existente por vuln IDs...
  
  // Novo: matching por CPE products
  const productNames = new Set<string>();
  for (const r of enrichedResults) {
    for (const svc of r.services) {
      for (const cpe of svc.cpe || []) {
        const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':');
        const product = (parts[2] || '').replace(/_/g, ' ');
        if (product) productNames.add(product.toLowerCase());
      }
    }
  }
  
  // Buscar CVEs do cache onde products contem algum desses nomes
  const { data: webCves } = await supabase
    .from('cve_cache')
    .select('cve_id, title, severity, score, advisory_url, products')
    .eq('module_code', 'external_domain');
  
  // Filtrar por product match
  for (const cve of webCves) {
    const cveProducts = (cve.products || []).map(p => p.toLowerCase());
    const titleLower = (cve.title || '').toLowerCase();
    for (const product of productNames) {
      if (cveProducts.some(cp => cp.includes(product)) || titleLower.includes(product)) {
        matches.push(cve);
        break;
      }
    }
  }
}
```

### Arquivos modificados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/refresh-cve-cache/index.ts` | Adicionar `syncNistNvdWebSource()` |
| `supabase/functions/attack-surface-scan/index.ts` | Expandir `correlateCVEs()` com matching por CPE |
| `src/pages/admin/CVEsCachePage.tsx` | Adicionar label/cor para `external_domain` |
| `src/components/admin/CVESourcesConfigDialog.tsx` | Adicionar labels para novos tipos |
| Dados: tabela `cve_sources` | Inserir registro da nova fonte |
