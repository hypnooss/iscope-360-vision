
# Fix: CORS bloqueando geolocalização do Firewall

## Causa raiz definitiva

A API `ipwho.is` retorna **403 - "CORS is not supported on the Free plan"** para todas as chamadas feitas do navegador. Isso significa que nenhuma tentativa de geolocalização funciona -- nem o hostname, nem os IPs de fallback. A resolução DNS via `dns.google` funciona corretamente (retornou o IP 200.170.138.44 para BR-PMP-FW-001), mas a chamada subsequente ao ipwho.is falha por CORS.

## Solução

Usar a API `https://ipapi.co/{ip}/json/` que suporta CORS gratuitamente e aceita chamadas HTTPS do navegador. Esta API retorna `latitude` e `longitude` no JSON de resposta.

Alternativa considerada: criar uma Edge Function proxy -- descartada por ser overengineering para uma chamada simples.

## Mudanças

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Substituir todas as chamadas a `ipwho.is` por `ipapi.co`:

**Antes:**
```typescript
const res = await fetch(`https://ipwho.is/${target}`);
const json = await res.json();
if (json.success) return { lat: json.latitude, lng: json.longitude };
```

**Depois:**
```typescript
const res = await fetch(`https://ipapi.co/${target}/json/`);
const json = await res.json();
if (!json.error) return { lat: json.latitude, lng: json.longitude };
```

A API `ipapi.co` retorna os mesmos campos `latitude`/`longitude`, mas usa `json.error` (booleano) para indicar falha em vez de `json.success`.

Tambem corrigir o caso do DNS resolver para um CNAME intermediario: o `dns.google` retornou dois records (CNAME + A). O codigo atual pega `Answer[0].data` que pode ser o CNAME em vez do IP. Precisa filtrar para pegar apenas o record tipo A (type=1).

**Correção DNS:**
```typescript
const resolvedIP = dnsJson?.Answer?.find((a: any) => a.type === 1)?.data;
```

### Resumo das alterações

1. Trocar `ipwho.is` por `ipapi.co` (suporta CORS + HTTPS)
2. Ajustar verificação de sucesso (`!json.error` em vez de `json.success`)
3. Filtrar record DNS tipo A (type=1) para evitar pegar CNAME
