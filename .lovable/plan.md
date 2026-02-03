

## Integrar VirusTotal como Fonte Complementar de Subdomínios

### Visão Geral

Adicionar a API do VirusTotal como fonte **complementar** (Fase 1.5) para enumeração de subdomínios. O VirusTotal fornece dados de Certificate Transparency logs e relações de domínio através de sua API de inteligência.

---

### Arquitetura Atualizada

```text
┌─────────────────────────────────────────────────────────────┐
│  FASE 1: APIs Pagas (Premium)                                │
│                                                              │
│  1.1 SecurityTrails (Primária)                               │
│  1.2 VirusTotal (Complementar) ← NOVA                        │
│                                                              │
│  Executadas sequencialmente para melhor controle             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  FASE 2: APIs Gratuitas (Paralelo)                           │
│  crt.sh, hackertarget, alienvault, rapiddns, etc.            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  FASE 3: Merge + Deduplicação + Resolução DNS                │
└─────────────────────────────────────────────────────────────┘
```

---

### Etapa 1: Adicionar Segredo

**Segredo a criar:**
- Nome: `VIRUSTOTAL_API_KEY`
- Valor: A chave que você já possui

---

### Etapa 2: Implementar Função VirusTotal

**Arquivo:** `supabase/functions/subdomain-enum/index.ts`

**Nova função após `querySecurityTrails` (linha ~540):**

```typescript
/**
 * Query VirusTotal API for subdomains (COMPLEMENTARY SOURCE).
 * Uses the domain relationships endpoint to find subdomains.
 * Requires API key stored in VIRUSTOTAL_API_KEY env variable.
 */
async function queryVirusTotal(domain: string, timeout: number): Promise<Set<string>> {
  const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
  const subdomains = new Set<string>();

  if (!apiKey) {
    console.log('[virustotal] API key not configured, skipping');
    return subdomains;
  }

  const url = `https://www.virustotal.com/api/v3/domains/${domain}/subdomains?limit=100`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log(`[virustotal] API returned ${response.status}`);
      return subdomains;
    }

    const data = await response.json();
    
    // VirusTotal returns { data: [{ id: "subdomain.domain.com", ... }] }
    for (const item of data.data || []) {
      const subdomain = item.id?.toLowerCase();
      if (subdomain && isValidSubdomain(subdomain, domain)) {
        subdomains.add(subdomain);
      }
    }

    console.log(`[virustotal] Found ${subdomains.size} subdomains`);
  } catch (e) {
    console.log(`[virustotal] Error: ${e}`);
  }

  return subdomains;
}
```

---

### Etapa 3: Modificar Função de Enumeração

**Alterar `enumerateSubdomains` para adicionar VirusTotal na Fase 1:**

```typescript
// ======================================
// PHASE 1: Premium APIs (Sequential)
// ======================================

// 1.1 SecurityTrails (Primary)
try {
  const securityTrailsSubs = await querySecurityTrails(cleanDomain, apiTimeout);
  if (securityTrailsSubs.size > 0) {
    sourcesUsed.push(`securitytrails (${securityTrailsSubs.size})`);
    for (const sub of securityTrailsSubs) {
      allSubdomains.set(sub, { sources: ['securitytrails'] });
    }
    console.log(`[subdomain-enum] SecurityTrails found ${securityTrailsSubs.size} subdomains`);
  }
} catch (e) {
  errors.push(`securitytrails: ${e}`);
  console.log(`[subdomain-enum] SecurityTrails error: ${e}`);
}

// 1.2 VirusTotal (Complementary)
try {
  const virusTotalSubs = await queryVirusTotal(cleanDomain, apiTimeout);
  if (virusTotalSubs.size > 0) {
    sourcesUsed.push(`virustotal (${virusTotalSubs.size})`);
    for (const sub of virusTotalSubs) {
      if (allSubdomains.has(sub)) {
        const existing = allSubdomains.get(sub)!;
        if (!existing.sources.includes('virustotal')) {
          existing.sources.push('virustotal');
        }
      } else {
        allSubdomains.set(sub, { sources: ['virustotal'] });
      }
    }
    console.log(`[subdomain-enum] VirusTotal found ${virusTotalSubs.size} subdomains`);
  }
} catch (e) {
  errors.push(`virustotal: ${e}`);
  console.log(`[subdomain-enum] VirusTotal error: ${e}`);
}

// ======================================
// PHASE 2: Free APIs (Complementary)
// ======================================
// ... código existente permanece igual
```

---

### Resultado Esperado

**Logs de Execução:**
```text
[subdomain-enum] Starting enumeration for precisio.com.br
[securitytrails] Found 47 subdomains
[virustotal] Found 23 subdomains
[subdomain-enum] Found 95 unique subdomains from 7 sources
```

**Fontes no Relatório:**
```text
Sources: securitytrails (47), virustotal (23), crt.sh (32), hackertarget (15), ...
```

---

### API VirusTotal - Detalhes Técnicos

| Aspecto | Valor |
|---------|-------|
| Endpoint | `/api/v3/domains/{domain}/subdomains` |
| Header de Auth | `x-apikey: {API_KEY}` |
| Rate Limit (Free) | 4 req/min, 500/dia |
| Rate Limit (Premium) | 1000 req/min |
| Limite por Request | 100 subdomínios (paginável) |

---

### Arquivos Modificados

1. **Segredos Supabase** - Adicionar `VIRUSTOTAL_API_KEY`
2. **`supabase/functions/subdomain-enum/index.ts`**:
   - Nova função `queryVirusTotal` (~50 linhas)
   - Modificar `enumerateSubdomains` para incluir VirusTotal na Fase 1

