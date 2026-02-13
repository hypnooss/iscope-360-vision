

# Separar Fontes de CVE por Produto e Migrar para Pagina Dedicada

## Contexto

Atualmente existem apenas 3 fontes monoliticas no `cve_sources`:
- "NIST NVD - Firewalls" (sincroniza FortiGate + SonicWall juntos)
- "NIST NVD - Servicos Web" (sincroniza todos os CPEs juntos: Nginx, Apache, OpenSSH, etc.)
- "Microsoft Security Response Center" (M365)

O usuario quer granularidade por produto e uma pagina dedicada (em vez de modal) para comportar mais fontes.

## Solucao

### 1. Reestruturar dados em `cve_sources`

Substituir as 3 fontes por fontes granulares por produto. Cada fonte tera um campo `config` com filtros especificos:

| source_label | module_code | source_type | config |
|---|---|---|---|
| FortiGate | firewall | nist_nvd | `{"vendor": "fortinet"}` |
| SonicWall | firewall | nist_nvd | `{"vendor": "sonicwall"}` |
| Microsoft 365 | m365 | msrc | `{"months": 3}` |
| Nginx | external_domain | nist_nvd_web | `{"product_filter": "nginx"}` |
| Apache HTTP Server | external_domain | nist_nvd_web | `{"product_filter": "http_server"}` |
| OpenSSH | external_domain | nist_nvd_web | `{"product_filter": "openssh"}` |

**Migracao SQL:**
- Deletar as 3 fontes existentes
- Inserir as novas fontes granulares
- CVEs existentes no `cve_cache` permanecem (serao re-associados na proxima sync)

### 2. Atualizar Edge Function `refresh-cve-cache`

**`syncNistNvdSource`** - Filtrar por vendor do config:
- Ler `source.config.vendor` e so processar firewalls daquele vendor
- Se `vendor = 'fortinet'`, so buscar firewalls com `device_type` Fortinet
- Se `vendor = 'sonicwall'`, so buscar firewalls com `device_type` SonicWall

**`syncNistNvdWebSource`** - Filtrar por produto do config:
- Ler `source.config.product_filter`
- Ao iterar CPEs dos snapshots, so incluir CPEs cujo campo `product` no CPE contenha o filtro
- Ex: `product_filter: "nginx"` so processa CPEs como `cpe:/a:igor_sysoev:nginx:1.28.0`

### 3. Criar pagina dedicada `/cves/sources`

Nova pagina `src/pages/admin/CVESourcesPage.tsx` com layout flat (seguindo padrao de management pages):

**Layout:**
- Breadcrumb: Administracao > CVEs > Fontes
- Titulo: "Fontes de CVE"
- Subtitulo: "Gerencie as fontes de sincronizacao de vulnerabilidades"
- Botao "Sincronizar Todas" no header
- Cards de estatisticas: Total Fontes, Ativas, Ultimo Sync, Erros
- Lista de fontes agrupadas por modulo (Firewall, M365, Dominio Externo)
- Cada fonte exibe: nome do produto, status, ultima sync, contagem de CVEs, toggle ativar/desativar, botao sincronizar

### 4. Atualizar `CVEsCachePage`

- Remover botao "Configurar Fontes" e o `CVESourcesConfigDialog`
- Adicionar botao "Gerenciar Fontes" que navega para `/cves/sources`
- Manter o restante da pagina igual

### 5. Atualizar rotas

- Adicionar rota `/cves/sources` no `App.tsx`
- Lazy load da nova pagina

## Detalhes Tecnicos

### Migracao SQL

```sql
-- Deletar fontes antigas
DELETE FROM cve_sources;

-- Inserir fontes granulares por produto
INSERT INTO cve_sources (module_code, source_type, source_label, config, is_active) VALUES
  ('firewall', 'nist_nvd', 'FortiGate', '{"vendor": "fortinet", "months": 6}', true),
  ('firewall', 'nist_nvd', 'SonicWall', '{"vendor": "sonicwall", "months": 6}', true),
  ('m365', 'msrc', 'Microsoft 365', '{"months": 3}', true),
  ('external_domain', 'nist_nvd_web', 'Nginx', '{"product_filter": "nginx"}', true),
  ('external_domain', 'nist_nvd_web', 'Apache HTTP Server', '{"product_filter": "http_server"}', true),
  ('external_domain', 'nist_nvd_web', 'OpenSSH', '{"product_filter": "openssh"}', true);
```

### Filtro por vendor no syncNistNvdSource

```typescript
const vendorFilter = (source.config as any)?.vendor;
// Filtrar firewalls pelo device_type do vendor
for (const h of histories) {
  const fw = firewalls.find(f => f.id === h.firewall_id);
  const vendor = fw?.device_type_id ? deviceTypeMap.get(fw.device_type_id) : 'fortinet';
  if (vendorFilter && vendor !== vendorFilter) continue;
  // ... processar normalmente
}
```

### Filtro por produto no syncNistNvdWebSource

```typescript
const productFilter = (source.config as any)?.product_filter?.toLowerCase();
// Ao coletar CPEs, filtrar pelo produto
for (const cpe of svc.cpe || []) {
  const parts = cpe.replace('cpe:2.3:', '').replace('cpe:/', '').split(':');
  const product = (parts[2] || '').toLowerCase();
  if (productFilter && !product.includes(productFilter)) continue;
  cpeSet.add(cpe);
}
```

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| Migracao SQL | Recriar fontes por produto |
| `supabase/functions/refresh-cve-cache/index.ts` | Adicionar filtros por vendor/produto |
| `src/pages/admin/CVESourcesPage.tsx` | Nova pagina dedicada (substituindo dialog) |
| `src/pages/admin/CVEsCachePage.tsx` | Trocar botao para navegar a /cves/sources |
| `src/components/admin/CVESourcesConfigDialog.tsx` | Remover (nao mais necessario) |
| `src/App.tsx` | Adicionar rota /cves/sources |

