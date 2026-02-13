

# Fix: Extrair tecnologias do httpx para sincronizacao de CVEs

## Problema

A funcao `syncNistNvdWebSource` so le CPEs de `services[].cpe` (detectados pelo Nmap). Porem, a maioria das tecnologias web sao detectadas pelo httpx e armazenadas em campos diferentes:

- **Nginx**: Aparece em `web_services[].server` e `web_services[].technologies`, mas com `cpe: []` no Nmap
- **History**: Aparece apenas em `web_services[].technologies` como `"History:4.7.2"` -- sem CPE algum

## Solucao

Expandir a extracao de produtos na funcao `syncNistNvdWebSource` para tambem ler `web_services[].technologies` e `web_services[].server`, gerando CPEs sinteticos quando necessario.

### Arquivo: `supabase/functions/refresh-cve-cache/index.ts`

**Logica atualizada de extracao** -- alem de `services[].cpe`, tambem iterar sobre `web_services`:

```
Para cada IP nos resultados:
  1. (existente) Ler services[].cpe
  2. (novo) Ler web_services[].technologies
     - Parsear formato "Nome:Versao" (ex: "History:4.7.2")
     - Gerar CPE sintetico: cpe:2.3:a:*:{nome}:{versao}:*:*:*:*:*:*:*
  3. (novo) Ler web_services[].server
     - Se "nginx", gerar CPE: cpe:2.3:a:f5:nginx:{versao_se_disponivel}:*:*:*:*:*:*:*
```

**Mapeamento de vendors conhecidos** para gerar CPEs corretos:

| Tecnologia | Vendor NVD | Produto NVD |
|---|---|---|
| Nginx | f5 | nginx |
| History | browsenpm | history |
| React | facebook | react |
| LazySizes | afarkas | lazysizes |

Para tecnologias desconhecidas, usar vendor `*` e buscar pelo nome do produto.

**Mudanca na query ao NVD**: Para CPEs sinteticos sem versao, usar `keywordSearch` em vez de `cpeName` para ampliar a busca.

### Detalhes tecnicos

A funcao de extracao de CPEs sera refatorada para:

```typescript
// Extrair CPEs do Nmap (existente)
for (const svc of (result as any).services || []) {
  for (const cpe of svc.cpe || []) { ... }
}

// NOVO: Extrair tecnologias do httpx
for (const ws of (result as any).web_services || []) {
  // Do campo technologies
  for (const tech of ws.technologies || []) {
    const [name, version] = tech.split(':');
    const normalizedName = name.toLowerCase().replace(/\s+/g, '_');
    if (productFilter && !normalizedName.includes(productFilter)) continue;
    
    // Gerar CPE sintetico
    const vendor = KNOWN_VENDORS[normalizedName] || '*';
    const ver = version || '*';
    const syntheticCpe = `cpe:2.3:a:${vendor}:${normalizedName}:${ver}:*:*:*:*:*:*:*`;
    cpeSet.add(syntheticCpe);
  }
  
  // Do campo server (nginx, apache, etc.)
  if (ws.server) {
    const serverName = ws.server.toLowerCase();
    if (!productFilter || serverName.includes(productFilter)) {
      const vendor = KNOWN_VENDORS[serverName] || '*';
      const syntheticCpe = `cpe:2.3:a:${vendor}:${serverName}:*:*:*:*:*:*:*:*`;
      cpeSet.add(syntheticCpe);
    }
  }
}
```

Mapa de vendors conhecidos:

```typescript
const KNOWN_VENDORS: Record<string, string> = {
  nginx: 'f5',
  apache: 'apache',
  openssh: 'openbsd',
  history: 'browserstate',
  react: 'facebook',
};
```

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/refresh-cve-cache/index.ts` | Expandir extracao para incluir web_services |

