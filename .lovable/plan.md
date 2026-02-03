

## Migração da Enumeração de Subdomínios para Edge Function

### Contexto

Atualmente, a enumeração de subdomínios roda no Python Agent (rede do cliente), o que causa:
1. **DNS mascarado** - IPs internos como `172.16.10.250` aparecem em vez dos IPs públicos reais
2. **APIs bloqueadas** - Firewalls corporativos podem bloquear as APIs de enumeração
3. **Dependência do ambiente** - Resultados variam conforme a rede do cliente

### Solução: Arquitetura Híbrida

```text
┌─────────────────────────────────────────────────────────────────┐
│                        NOVA ARQUITETURA                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────────┐  │
│  │   Frontend   │──────│  trigger-    │──────│  agent_tasks  │  │
│  │ (Disparar)   │      │  external-   │      │   (pending)   │  │
│  └──────────────┘      │  domain-     │      └───────┬───────┘  │
│                        │  analysis    │              │          │
│                        └──────────────┘              ▼          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Python Agent                         │   │
│  │  Executa APENAS steps de DNS direto:                      │   │
│  │  • ns_records, mx_records, soa_record                     │   │
│  │  • spf_record, dmarc_record, dkim_records, dnssec_status  │   │
│  │                                                           │   │
│  │  NÃO executa mais: subdomain_enum                         │   │
│  └──────────────────────────────┬───────────────────────────┘   │
│                                 │                                │
│                                 ▼                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  agent-task-result                        │   │
│  │  1. Recebe resultado dos steps DNS                        │   │
│  │  2. Detecta target_type = 'external_domain'               │   │
│  │  3. Chama subdomain-enum Edge Function                    │   │
│  │  4. Mescla resultado dos subdomínios com os dados DNS     │   │
│  │  5. Processa compliance rules + salva histórico           │   │
│  └──────────────────────────────┬───────────────────────────┘   │
│                                 │                                │
│                                 ▼                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              subdomain-enum (NOVA)                        │   │
│  │  • Consulta 9 APIs públicas (crt.sh, HackerTarget, etc.)  │   │
│  │  • Usa DNS-over-HTTPS (Cloudflare/Google)                 │   │
│  │  • Retorna IPs públicos reais (sem mascaramento)          │   │
│  │  • Executa em ambiente neutro (Supabase Edge)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Criar/Modificar

#### 1. Nova Edge Function: `supabase/functions/subdomain-enum/index.ts`

Responsável por:
- Consultar as 9 APIs de enumeração (crt.sh, HackerTarget, AlienVault, RapidDNS, ThreatMiner, URLScan, Wayback, CertSpotter, JLDC)
- Validar subdomínios via DNS-over-HTTPS (Cloudflare/Google) para obter IPs públicos reais
- Retornar lista de subdomínios com status `is_alive` e `ips`

```typescript
// Estrutura principal
interface SubdomainEnumRequest {
  domain: string;
  timeout?: number; // segundos
}

interface SubdomainEnumResponse {
  success: boolean;
  domain: string;
  total_found: number;
  alive_count: number;
  inactive_count: number;
  sources: string[];
  subdomains: SubdomainEntry[];
  errors?: string[];
  execution_time_ms: number;
}

// Resolução DNS via DoH (Cloudflare)
async function resolveDNS(hostname: string): Promise<string[]> {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/dns-json' } });
  const data = await resp.json();
  return data.Answer?.filter(a => a.type === 1).map(a => a.data) || [];
}
```

#### 2. Atualizar: `supabase/functions/agent-task-result/index.ts`

Modificar para:
- Detectar quando `target_type === 'external_domain'`
- Chamar a edge function `subdomain-enum` via fetch interno
- Mesclar o resultado no `rawData` antes de processar compliance rules

```typescript
// Após reconstruir rawData dos step_results (linha ~3800)
if (task.target_type === 'external_domain' && rawData) {
  // Get domain from task payload
  const domain = (task.payload as any)?.domain;
  if (domain) {
    console.log(`[external_domain] Invoking subdomain-enum for ${domain}`);
    
    const subdomainResult = await invokeSubdomainEnum(domain);
    if (subdomainResult) {
      // Inject subdomain data as if it came from agent step
      rawData['subdomain_enum'] = {
        data: subdomainResult
      };
    }
  }
}
```

#### 3. Atualizar Blueprint no Banco de Dados

Remover o step `subdomain_enum` do blueprint de `external_domain`:

```sql
UPDATE device_blueprints 
SET collection_steps = '{"steps": [
  {"id": "ns_records", "type": "dns_query", "config": {"query_type": "NS"}},
  {"id": "mx_records", "type": "dns_query", "config": {"query_type": "MX"}},
  {"id": "soa_record", "type": "dns_query", "config": {"query_type": "SOA"}},
  {"id": "spf_record", "type": "dns_query", "config": {"query_type": "SPF"}},
  {"id": "dmarc_record", "type": "dns_query", "config": {"query_type": "DMARC"}},
  {"id": "dkim_records", "type": "dns_query", "config": {"query_type": "DKIM", "selectors": [...], "best_effort": true}},
  {"id": "dnssec_status", "type": "dns_query", "config": {"query_type": "DNSSEC", "best_effort": true}}
]}'::jsonb
WHERE device_type_id = (SELECT id FROM device_types WHERE code = 'external_domain')
  AND is_active = true;
```

#### 4. Python Agent (Opcional - Limpeza)

Arquivos que podem ser removidos ou mantidos para uso futuro:
- `python-agent/agent/executors/subdomain_enum.py` - Pode ser removido
- `python-agent/agent/executors/__init__.py` - Remover import do SubdomainEnumExecutor
- `python-agent/agent/tasks.py` - Remover mapeamento de `subdomain_enum`

---

### Detalhes Técnicos

#### APIs de Enumeração (TypeScript/Deno)

| API | Endpoint | Formato | Rate Limit |
|-----|----------|---------|------------|
| crt.sh | `crt.sh/?q=%25.{domain}&output=json` | JSON | Ilimitado |
| HackerTarget | `api.hackertarget.com/hostsearch/?q={domain}` | CSV | 100/dia |
| AlienVault | `otx.alienvault.com/api/v1/indicators/domain/{domain}/passive_dns` | JSON | Rate limited |
| RapidDNS | `rapiddns.io/subdomain/{domain}?full=1` | HTML | Ilimitado |
| ThreatMiner | `api.threatminer.org/v2/domain.php?q={domain}&rt=5` | JSON | Instável |
| URLScan | `urlscan.io/api/v1/search/?q=domain:{domain}` | JSON | 100/dia |
| Wayback | `web.archive.org/cdx/search/cdx?url=*.{domain}/*` | JSON | Bloqueio frequente |
| CertSpotter | `api.certspotter.com/v1/issuances?domain={domain}` | JSON | 100/hora |
| JLDC | `jldc.me/anubis/subdomains/{domain}` | JSON | SSL issues |

#### DNS-over-HTTPS (DoH)

Usar Cloudflare como primário, Google como fallback:
- **Cloudflare**: `https://cloudflare-dns.com/dns-query?name={hostname}&type=A`
- **Google**: `https://dns.google/resolve?name={hostname}&type=A`

Isso garante resolução de IPs públicos reais, sem interferência de DNS internos.

---

### Benefícios

| Aspecto | Antes (Agent) | Depois (Edge Function) |
|---------|---------------|------------------------|
| **DNS** | Mascarado por DNS interno | IPs públicos reais via DoH |
| **APIs** | Podem estar bloqueadas | Sempre acessíveis |
| **Consistência** | Varia por ambiente | Sempre igual |
| **Manutenção** | Python + TypeScript | TypeScript centralizado |
| **Tempo** | Depende do Agent processar | Paralelo ao Agent |

---

### Considerações

1. **Timeout de Edge Functions**: Limite de ~30s no Supabase. Para muitos subdomínios, processar em batches ou limitar a 200-300 resoluções DNS.

2. **Fallback**: Se a edge function falhar, o relatório ainda terá os dados DNS (MX, SPF, DMARC, etc.) - apenas a seção de subdomínios ficará vazia.

3. **Cache**: Considerar cache de 24h para domínios já analisados recentemente.

---

### Ordem de Implementação

1. Criar edge function `subdomain-enum` com todas as 9 APIs + DoH
2. Testar edge function isoladamente
3. Atualizar `agent-task-result` para chamar a nova função
4. Atualizar blueprint no banco (remover step subdomain_enum)
5. Deploy e testar fluxo completo
6. (Opcional) Remover código do Python Agent

