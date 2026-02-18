
# Fix: Geolocalização falha com ipapi.co — Trocar por ipwho.is

## Diagnóstico

Os IPs WAN `186.233.96.14` e `170.150.137.198` estão sendo detectados **corretamente** — o filtro de interfaces funcionou. O problema é na **etapa de geolocalização**, que chama `ipapi.co` diretamente do browser.

O `ipapi.co` na versão gratuita:
- Limita 1.000 requests/dia por IP de origem
- Bloqueia requests vindas de IPs de datacenter ou CDN (como os usados pelos previews do Lovable)
- Pode retornar `{"error": true, "reason": "RateLimited"}` — o código trata isso como falha silenciosa (retorna `null`)

Por isso `candidates.length === 0` e a mensagem de erro aparece, mesmo com os IPs válidos.

## Solução: Substituir ipapi.co por ipwho.is

`ipwho.is` é gratuito, sem chave, suporta HTTPS e CORS sem restrições de datacenter.

Formato de resposta do `ipwho.is`:
```json
{
  "ip": "186.233.96.14",
  "success": true,
  "latitude": -23.5,
  "longitude": -46.6,
  "country": "Brazil",
  "country_code": "BR",
  "region": "São Paulo",
  "city": "São Paulo"
}
```

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/geolocation.ts` | Trocar `ipapi.co` por `ipwho.is` (campos: `latitude`, `longitude`) |
| `src/pages/environment/AddFirewallPage.tsx` | Trocar `ipapi.co` por `ipwho.is` no Step 4 de geolocalização |
| `src/pages/firewall/AnalyzerDashboardPage.tsx` | Trocar `ipapi.co` por `ipwho.is` para consistência |

## Detalhes Técnicos

### Mudança em geolocation.ts

```typescript
// ANTES
const res = await fetch(`https://ipapi.co/${target}/json/`);
if (json.error || !json.latitude || !json.longitude) return null;
return { lat: json.latitude, lng: json.longitude };

// DEPOIS
const res = await fetch(`https://ipwho.is/${target}`);
if (!json.success || !json.latitude || !json.longitude) return null;
return { lat: json.latitude, lng: json.longitude };
```

### Mudança em AddFirewallPage.tsx (Step 4)

```typescript
// ANTES
const res = await fetch(`https://ipapi.co/${w.ip}/json/`);
if (json.error || !json.latitude || !json.longitude) return null;
return { ..., country: json.country_name, country_code: json.country_code.toLowerCase() };

// DEPOIS
const res = await fetch(`https://ipwho.is/${w.ip}`);
if (!json.success || !json.latitude || !json.longitude) return null;
return { ..., country: json.country, country_code: (json.country_code || '').toLowerCase() };
```

A diferença de campos:
- `country_name` (ipapi.co) → `country` (ipwho.is)
- `json.error` (ipapi.co) → `!json.success` (ipwho.is)
- Resto igual: `latitude`, `longitude`, `region`, `city`, `country_code`

## Resultado Esperado

Após a mudança, o clique em "Buscar" com o firewall BR-PNC-FW-001 deve:
1. Detectar `wan1` (`186.233.96.14`) e `wan2` (`170.150.137.198`)
2. Geolocalizar ambos via `ipwho.is` com sucesso
3. Abrir o dialog de seleção com as duas opções, bandeiras do Brasil e dados de localização
