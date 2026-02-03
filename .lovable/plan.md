

## Integrar SecurityTrails como API Primária para Enumeração de Subdomínios

### Visão Geral

Adicionar a API SecurityTrails como fonte **primária** de enumeração de subdomínios, executando antes das demais APIs gratuitas. A chave será armazenada como segredo no Supabase Edge Functions.

---

### Arquitetura de Priorização

```text
┌─────────────────────────────────────────────────────────────┐
│  1. SECURITYTRAILS (API Paga - Primária)                     │
│     - Executada primeiro, isoladamente                       │
│     - Melhor qualidade e cobertura                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. APIs Gratuitas (Paralelo)                                │
│     crt.sh, hackertarget, alienvault, rapiddns, etc.         │
│     - Complementam resultados do SecurityTrails              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Merge + Deduplicação                                     │
│     - Combina todas as fontes                                │
│     - Registra origem de cada subdomínio                     │
└─────────────────────────────────────────────────────────────┘
```

---

### Etapa 1: Adicionar Segredo

**Segredo a criar:**
- Nome: `SECURITYTRAILS_API_KEY`
- Valor: A chave fornecida

---

### Etapa 2: Implementar Função SecurityTrails

**Arquivo:** `supabase/functions/subdomain-enum/index.ts`

**Nova função após linha ~489:**

```typescript
/**
 * Query SecurityTrails API for subdomains (PRIMARY SOURCE).
 * Requires API key stored in SECURITYTRAILS_API_KEY env variable.
 */
async function querySecurityTrails(domain: string, timeout: number): Promise<Set<string>> {
  const apiKey = Deno.env.get('SECURITYTRAILS_API_KEY');
  const subdomains = new Set<string>();

  if (!apiKey) {
    console.log('[securitytrails] API key not configured, skipping');
    return subdomains;
  }

  const url = `https://api.securitytrails.com/v1/domain/${domain}/subdomains`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        'APIKEY': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[securitytrails] API returned ${response.status}`);
      return subdomains;
    }

    const data = await response.json();
    
    // SecurityTrails returns { subdomains: ["www", "mail", ...], endpoint: "/v1/..." }
    for (const sub of data.subdomains || []) {
      const fullSubdomain = `${sub}.${domain}`.toLowerCase();
      if (isValidSubdomain(fullSubdomain, domain)) {
        subdomains.add(fullSubdomain);
      }
    }

    console.log(`[securitytrails] Found ${subdomains.size} subdomains`);
  } catch (e) {
    console.log(`[securitytrails] Error: ${e}`);
  }

  return subdomains;
}
```

---

### Etapa 3: Modificar Função de Enumeração

**Alterar `enumerateSubdomains` (linhas 495-607):**

```typescript
async function enumerateSubdomains(domain: string, apiTimeout = 15000): Promise<SubdomainEnumResponse> {
  const startTime = Date.now();
  const allSubdomains = new Map<string, { sources: string[] }>();
  const sourcesUsed: string[] = [];
  const errors: string[] = [];

  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').split('/')[0];

  console.log(`[subdomain-enum] Starting enumeration for ${cleanDomain}`);

  // ======================================
  // FASE 1: SecurityTrails (API Primária)
  // ======================================
  try {
    const securityTrailsSubs = await querySecurityTrails(cleanDomain, apiTimeout);
    if (securityTrailsSubs.size > 0) {
      sourcesUsed.push(`securitytrails (${securityTrailsSubs.size})`);
      for (const sub of securityTrailsSubs) {
        allSubdomains.set(sub, { sources: ['securitytrails'] });
      }
    }
  } catch (e) {
    errors.push(`securitytrails: ${e}`);
  }

  // ======================================
  // FASE 2: APIs Gratuitas (Complementares)
  // ======================================
  const apiQueries = [
    { name: 'crt.sh', fn: () => queryCrtsh(cleanDomain, apiTimeout) },
    { name: 'hackertarget', fn: () => queryHackerTarget(cleanDomain, apiTimeout) },
    { name: 'alienvault', fn: () => queryAlienVault(cleanDomain, apiTimeout) },
    { name: 'rapiddns', fn: () => queryRapidDNS(cleanDomain, apiTimeout) },
    { name: 'threatminer', fn: () => queryThreatMiner(cleanDomain, apiTimeout) },
    { name: 'urlscan', fn: () => queryURLScan(cleanDomain, apiTimeout) },
    { name: 'wayback', fn: () => queryWayback(cleanDomain, apiTimeout) },
    { name: 'certspotter', fn: () => queryCertSpotter(cleanDomain, apiTimeout) },
    { name: 'jldc', fn: () => queryJLDC(cleanDomain, apiTimeout) },
  ];

  const results = await Promise.allSettled(apiQueries.map(async (api) => {
    try {
      const subs = await api.fn();
      return { name: api.name, subdomains: subs };
    } catch (e) {
      return { name: api.name, error: String(e), subdomains: new Set<string>() };
    }
  }));

  // Process results (merge com SecurityTrails)
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { name, subdomains, error } = result.value;
      
      if (error) {
        errors.push(`${name}: ${error}`);
      }

      if (subdomains.size > 0) {
        sourcesUsed.push(`${name} (${subdomains.size})`);
        
        for (const sub of subdomains) {
          if (allSubdomains.has(sub)) {
            const existing = allSubdomains.get(sub)!;
            if (!existing.sources.includes(name)) {
              existing.sources.push(name);
            }
          } else {
            allSubdomains.set(sub, { sources: [name] });
          }
        }
      }
    } else {
      errors.push(`API query failed: ${result.reason}`);
    }
  }

  // ... resto da função permanece igual (DNS resolution, sorting, etc.)
}
```

---

### Resultado Esperado

**Logs:**
```text
[subdomain-enum] Starting enumeration for precisio.com.br
[securitytrails] Found 47 subdomains
[subdomain-enum] Found 89 unique subdomains from 6 sources
```

**Fontes no relatório:**
```text
Sources: securitytrails (47), crt.sh (32), hackertarget (15), ...
```

---

### Segurança

| Aspecto | Implementação |
|---------|---------------|
| API Key | Armazenada como segredo Supabase, nunca no código |
| Fallback | Se SecurityTrails falhar, APIs gratuitas continuam |
| Rate Limit | SecurityTrails: 50 req/dia (free), 2000/dia (starter) |

---

### Arquivos Modificados

1. **Segredos Supabase** - Adicionar `SECURITYTRAILS_API_KEY`
2. **`supabase/functions/subdomain-enum/index.ts`**:
   - Nova função `querySecurityTrails`
   - Modificar `enumerateSubdomains` para execução em 2 fases

---

### Recomendação de Segurança

⚠️ **Importante**: A API key foi exposta neste chat. Recomendo gerar uma nova chave no painel SecurityTrails após a integração estar funcionando.

