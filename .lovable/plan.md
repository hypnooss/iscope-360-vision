
# Fix Definitivo: Geolocalização server-side via Edge Function

## Causa Raiz

O diagnóstico via network logs foi conclusivo:

```
GET https://ipwho.is/186.233.96.14
Status: 403
Response: {"success":false,"message":"CORS is not supported on the Free plan"}
```

Tanto `ipapi.co` quanto `ipwho.is` **bloqueiam chamadas CORS do browser no plano gratuito**. Qualquer API de GeoIP chamada diretamente do frontend terá o mesmo problema — não é uma questão de provedor, mas de arquitetura.

## Solução: Mover a geolocalização para a Edge Function existente

Já existe a Edge Function `resolve-firewall-geo` que faz tudo server-side. A edge function já usa `ip-api.com/batch` nas outras funções do projeto (`firewall-analyzer`), que é uma API gratuita sem restrições de CORS quando chamada do servidor.

### Fluxo atual (quebrado)
```text
Browser → resolve-firewall-geo (cria task) → Agent (coleta IPs WAN)
Browser ← polling: IPs WAN
Browser → ipwho.is (CORS BLOQUEADO) ❌
```

### Fluxo corrigido
```text
Browser → resolve-firewall-geo (cria task) → Agent (coleta IPs WAN)
Browser ← polling: IPs WAN
Browser → resolve-firewall-geo/geolocate (lista de IPs) → ip-api.com (server-side)
Browser ← candidatos com lat/lng, país, cidade ✅
```

## Mudanças necessárias

### 1. Edge Function `resolve-firewall-geo` — novo endpoint `POST /geolocate`

A função já existe. Adicionar suporte a uma segunda operação: quando o body contém `ips` (array de strings), faz a geolocalização server-side usando `ip-api.com/batch` (já usado no `firewall-analyzer`).

```typescript
// Novo bloco na edge function
const { ips } = await req.json();

if (ips && Array.isArray(ips)) {
  // Geolocalizar via ip-api.com (server-side, sem CORS)
  const response = await fetch('http://ip-api.com/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ips.map(ip => ({ query: ip, fields: 'status,lat,lon,country,countryCode,regionName,city' }))),
  });
  const results = await response.json();
  return results;
}
```

### 2. `AddFirewallPage.tsx` — remover fetch ao ipwho.is, chamar a edge function

Em vez de:
```typescript
// ANTES (CORS bloqueado)
const res = await fetch(`https://ipwho.is/${w.ip}`);
```

Passar para:
```typescript
// DEPOIS — server-side via edge function
const { data } = await supabase.functions.invoke('resolve-firewall-geo', {
  body: { ips: wanIPs.map(w => w.ip) }
});
// data = array de { query, status, lat, lon, country, countryCode, regionName, city }
```

### 3. Remover a geolocalização do `src/lib/geolocation.ts` para o contexto browser

A função `tryGeolocate` em `geolocation.ts` tem o mesmo problema — ela é chamada indiretamente via browser também. Ela deve ser ajustada para usar a edge function ou apenas marcar que não é adequada para uso browser-side direto com IPs externos.

## Arquivos modificados

| Arquivo | Operação |
|---|---|
| `supabase/functions/resolve-firewall-geo/index.ts` | Adicionar suporte ao payload `{ ips: string[] }` para geolocalização server-side via `ip-api.com/batch` |
| `src/pages/environment/AddFirewallPage.tsx` | Substituir fetch ao `ipwho.is` por `supabase.functions.invoke('resolve-firewall-geo', { body: { ips } })` |

## Mapeamento de campos ip-api.com

| Campo ip-api.com | Uso no sistema |
|---|---|
| `lat` | `geo_latitude` |
| `lon` | `geo_longitude` |
| `country` | Nome do país |
| `countryCode` | Código 2 letras (para bandeira) |
| `regionName` | Estado/Região |
| `city` | Cidade |
| `status` | `"success"` ou `"fail"` |

## Resultado esperado

Ao clicar em "Buscar" com o BR-PNC-FW-001:
1. Agent executa e retorna `wan1: 186.233.96.14`, `wan2: 170.150.137.198`
2. Frontend chama `resolve-firewall-geo` com `{ ips: ["186.233.96.14", "170.150.137.198"] }`
3. Edge Function chama `ip-api.com/batch` server-side — sem CORS
4. Dialog de seleção abre com os dois IPs geolocalizados com bandeiras e cidade
