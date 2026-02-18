
# Botão "Buscar" — Geolocalização via API do FortiGate

## Contexto e Análise

### Fluxo atual do botão "Buscar"
O botão chama `resolveGeoFromUrl(formData.fortigate_url)` (em `src/lib/geolocation.ts`), que:
1. Tenta resolver o hostname da URL via DNS público (dns.google)
2. Consulta o IP resultante na ipapi.co

**Problema**: o FortiGate normalmente tem IP privado (`192.168.x.x`), então a consulta DNS retorna um IP privado que não pode ser geolocalizados — resultado: "Não foi possível determinar a localização".

### Fluxo desejado
1. Chamar a API REST do FortiGate (`/api/v2/cmdb/system/interface`) com URL + API Key do formulário
2. Filtrar interfaces com `role = wan` (a lógica já existe em `fortigate-compliance`)
3. Extrair IPs públicos dessas interfaces
4. Consultar geolocalização pelo IP público
5. Preencher Latitude/Longitude automaticamente

### Viabilidade técnica
A Edge Function `fortigate-compliance` já demonstra que é possível chamar a API do FortiGate diretamente da nuvem Supabase usando `fetchWithoutSSLVerification` (ignora certificados auto-assinados). Isso **só funciona se o FortiGate for acessível externamente** — o que é o caso quando o campo "URL do FortiGate" contém um IP/hostname público.

Para firewalls em rede interna (IP privado), o fallback atual (DNS da URL) continua sendo a melhor alternativa disponível sem o firewall já cadastrado.

## Solução: Nova Edge Function `resolve-firewall-geo`

Criar uma Edge Function leve e dedicada que:
1. Recebe `{ url, api_key }` via POST
2. Chama `/api/v2/cmdb/system/interface` no FortiGate
3. Filtra interfaces WAN (mesma lógica do `fortigate-compliance`)
4. Extrai o primeiro IP público das interfaces WAN
5. Consulta ipapi.co para obter latitude/longitude
6. Retorna `{ lat, lng, ip, interface_name }` ou erro estruturado

### Lógica de classificação WAN (reaproveitada)
A Edge Function reutilizará a mesma hierarquia de prioridade já validada:
1. Interface `virtual-wan-link` → WAN
2. Membro SD-WAN → WAN
3. Campo `role` da API = "wan" → WAN
4. Nome com padrão `/^(wan|wan\d+|internet|isp|...)/i` → WAN

### Extração de IPs públicos
Das interfaces WAN, filtrar IPs que **não** são privados:
- Não `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `127.x.x.x`

## Mudanças no Frontend (`AddFirewallPage.tsx`)

### Botão "Buscar" — nova lógica
Substituir a chamada a `resolveGeoFromUrl` por uma chamada à nova Edge Function:

```
1. Validar que url e api_key estão preenchidos
2. Chamar edge function resolve-firewall-geo com { url, api_key }
3. Se retornar geo: preencher campos + toast de sucesso com IP encontrado
4. Se retornar erro de conexão (FortiGate inacessível):
   - Fallback para resolveGeoFromUrl(url) — comportamento atual
   - Toast informando que está usando geolocalização da URL
5. Se fallback também falhar: toast de erro explicativo
```

### Habilitar o botão "Buscar"
Atualmente o botão só requer `fortigate_url`. Com a nova lógica, o botão deve também requerer `api_key` (já que a nova abordagem principal precisa dos dois). O botão permanece habilitado apenas com `url` para o fallback continuar funcionando — mas a condição primária será `url && api_key`.

### Feedback visual ao usuário
- Enquanto carrega: spinner (já existe)
- Sucesso via FortiGate API: `"📍 IP WAN encontrado: 201.x.x.x → -23.5505, -46.6333"`
- Sucesso via fallback DNS: `"📍 Localização estimada pela URL (IP interno detectado)"`
- Falha: mensagem explicativa

## Arquivos a criar/modificar

### Novo arquivo: `supabase/functions/resolve-firewall-geo/index.ts`
Edge Function leve (~150 linhas) com a lógica descrita acima.

### Modificar: `src/pages/environment/AddFirewallPage.tsx`
- Atualizar o handler `onClick` do botão "Buscar" (linhas 764–777)
- Manter `resolveGeoFromUrl` como fallback
- Atualizar `disabled` do botão para `geoLoading || !formData.fortigate_url` (sem mudança — o fallback ainda funciona só com URL)

## Estrutura da Edge Function

```text
POST /resolve-firewall-geo
Body: { url: string, api_key: string }

Sucesso:
{ success: true, lat: number, lng: number, ip: string, interface: string }

Erro de conectividade (FortiGate inacessível):
{ success: false, error: "connection_failed", message: "..." }

Erro de autenticação:
{ success: false, error: "auth_failed", message: "..." }

Nenhum IP público encontrado:
{ success: false, error: "no_public_ip", message: "..." }
```

## Fluxo completo no formulário

```text
Usuário preenche URL + API Key
          ↓
Clica "Buscar"
          ↓
Edge Function chama FortiGate API
  ├── Sucesso → extrai IPs WAN públicos → geolocaliza → preenche campos
  └── Falha (inacessível/auth) → fallback DNS da URL
                  ├── Sucesso → preenche campos (avisa que é estimativa)
                  └── Falha → toast de erro explicativo
```

## Arquivos

- `supabase/functions/resolve-firewall-geo/index.ts` — criar (Edge Function nova)
- `src/pages/environment/AddFirewallPage.tsx` — modificar handler do botão "Buscar" (linhas 764–777)
