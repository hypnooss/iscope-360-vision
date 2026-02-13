

# Exibir CVEs do cache no Inventario de IPs + Ajustes esteticos

## 1. Exibir CVEs na coluna do Inventario de IPs

### Problema
A funcao `matchCVEsToIP` usa apenas `snapshot.cve_matches` (populado no momento do scan). Porem, o cache de CVEs (`cve_cache`) ja possui dados ricos (OpenSSH, PHP, Apache, etc.) que nao estao sendo exibidos.

### Solucao
Buscar CVEs do `cve_cache` com `module_code = 'external_domain'` e fazer o match por IP baseado em:
- CPEs do Nmap (`services[].cpe` -> extrair produto)
- Tecnologias do httpx (`web_services[].technologies` -> parsear "Nome:Versao")
- Servidor do httpx (`web_services[].server`)

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

- Adicionar um `useQuery` para buscar `cve_cache` onde `module_code = 'external_domain'`
- Expandir `matchCVEsToIP` para tambem receber os CVEs do cache e fazer match por:
  - Produto do CPE do Nmap (ja existente)
  - Produto do campo `products` do `cve_cache` vs tecnologias/servidor do httpx
- Combinar CVEs do snapshot + CVEs do cache (deduplicar por `cve_id`)

Logica de match expandida:

```
Para cada IP:
  1. Coletar produtos de services[].cpe (existente)
  2. Coletar tecnologias de web_services[].technologies (novo)
     - Parsear "PHP:8.3.27" -> produto "php", versao "8.3.27"
  3. Coletar web_services[].server (novo)
     - "nginx" -> produto "nginx"
  4. Buscar no cve_cache: CVEs cujo campo 'products' 
     contenha algum dos produtos detectados
  5. Para match com versao: verificar se a versao do CVE
     corresponde a versao detectada
```

## 2. Ajustes esteticos

### Problema
- Web Services e Certificados TLS usam `CardContent className="p-0"` (tabela encosta na borda)
- Inventario de IPs usa `CardContent` padrao (tabela tem padding)
- Titulos dos cards tem tamanhos diferentes (`text-sm` vs `text-lg`)

### Solucao
Padronizar todos os 3 cards:
- **CardContent**: Usar padding padrao em todos (remover `p-0` de Web Services e TLS)
- **CardTitle**: Usar `text-lg` em todos (igual ao Inventario de IPs)
- **Icones**: Manter `w-5 h-5` em todos (igual ao Inventario de IPs)

| Card | CardContent atual | CardTitle atual | Padronizado |
|---|---|---|---|
| Web Services | `p-0` | `text-sm font-medium`, icone `w-4 h-4` | padding padrao, `text-lg`, icone `w-5 h-5` |
| Certificados TLS | `p-0` | `text-sm font-medium`, icone `w-4 h-4` | padding padrao, `text-lg`, icone `w-5 h-5` |
| Inventario IPs | padding padrao | `text-lg`, icone `w-5 h-5` | (ja correto) |

### Detalhes tecnicos

#### Arquivo modificado: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**Mudancas no WebServicesSection (linha ~344)**:
- `CardContent className="p-0"` -> `CardContent`
- `CardTitle className="text-sm font-medium ..."` -> `CardTitle className="text-lg ..."`
- Icone `w-4 h-4` -> `w-5 h-5`

**Mudancas no TLSCertificatesSection (linha ~495)**:
- `CardContent className="p-0"` -> `CardContent`
- `CardTitle className="text-sm font-medium ..."` -> `CardTitle className="text-lg ..."`
- Icone `w-4 h-4` -> `w-5 h-5`

**Mudancas no CVEAlertSection (linha ~282)**:
- `CardTitle className="text-sm font-medium ..."` -> `CardTitle className="text-lg ..."`
- Icone `w-4 h-4` -> `w-5 h-5`

**Nova query para CVE cache**:
```typescript
const { data: cachedCVEs } = useQuery({
  queryKey: ['cve-cache', 'external_domain'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('cve_cache')
      .select('cve_id, title, severity, score, advisory_url, products')
      .eq('module_code', 'external_domain');
    if (error) throw error;
    return data || [];
  },
  staleTime: 1000 * 60 * 5,
});
```

**Match expandido**: A funcao `matchCVEsToIP` recebera um parametro adicional `cachedCVEs` e fara match por produtos detectados no IP (nmap CPEs + httpx technologies + httpx server) contra o campo `products` dos CVEs do cache.
