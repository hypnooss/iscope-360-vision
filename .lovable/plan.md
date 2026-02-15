
# Fix: Geolocalização do Firewall no Mapa de Ataques

## Causas Raiz Identificadas

1. **ipwho.is nao aceita hostnames DNS**: A chamada `ipwho.is/br-pmp-fw-001.gdmseeds.com` retorna `success: false` com mensagem "Invalid IP address". Apenas IPs sao aceitos.

2. **Dependencias incorretas no queryKey**: A query so rastreia `topAuthIPsSuccess` (que esta sempre vazio `[]`), mas o fallback real depende de `topAuthIPsFailed`. A query executa antes do snapshot carregar, retorna null, e quando o snapshot carrega, o queryKey muda de `undefined` para `[]` mas o resultado cacheado de null com staleTime de 30 minutos impede nova execucao efetiva.

3. **Ambos firewalls afetados**: BAU-FW tem IP privado (172.16.10.2) e BR-PMP-FW-001 tem DNS que ipwho.is nao resolve. Em ambos os casos, `topAuthIPsSuccess` esta vazio, entao a unica chance e o fallback `topAuthIPsFailed`.

## Solucao

Reescrever a logica de geolocalizacao com tres correcoes:

### 1. Resolver DNS para IP antes de chamar ipwho.is

Para hostnames DNS (como `br-pmp-fw-001.gdmseeds.com`), usar a API `dns.google/resolve` para obter o IP primeiro, e entao chamar ipwho.is com o IP resolvido.

### 2. Condicionar a query ao snapshot estar carregado

Mudar `enabled` para so executar quando o snapshot ja estiver disponivel (ou quando o hostname for publico e nao-DNS). Isso garante que os fallbacks tenham dados.

### 3. Incluir topAuthIPsFailed no queryKey

Rastrear tambem `topAuthIPsFailed` no queryKey para garantir re-execucao quando esses dados ficarem disponiveis.

## Detalhes tecnicos

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Substituir o bloco da query `firewall-geo` (linhas 221-257) por:

```typescript
// Helper: check if string looks like an IP (vs DNS hostname)
const looksLikeIP = (s: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);

const { data: firewallGeo } = useQuery({
  queryKey: [
    'firewall-geo',
    firewallHostname,
    snapshot?.metrics?.topAuthIPsSuccess?.[0]?.ip,
    snapshot?.metrics?.topAuthIPsFailed?.[0]?.ip,
  ],
  queryFn: async () => {
    const tryGeolocate = async (target: string) => {
      const res = await fetch(`https://ipwho.is/${target}`);
      const json = await res.json();
      if (json.success) return { lat: json.latitude as number, lng: json.longitude as number };
      return null;
    };

    // 1. Try hostname directly (works if it's a public IP)
    if (firewallHostname && !isPrivateIP(firewallHostname)) {
      if (looksLikeIP(firewallHostname)) {
        const result = await tryGeolocate(firewallHostname);
        if (result) return result;
      } else {
        // DNS hostname: resolve to IP first via dns.google
        try {
          const dnsRes = await fetch(
            `https://dns.google/resolve?name=${firewallHostname}&type=A`
          );
          const dnsJson = await dnsRes.json();
          const resolvedIP = dnsJson?.Answer?.[0]?.data;
          if (resolvedIP) {
            const result = await tryGeolocate(resolvedIP);
            if (result) return result;
          }
        } catch { /* DNS resolution failed, try fallbacks */ }
      }
    }

    // 2. Fallback: first successful auth IP
    const fb1 = snapshot?.metrics?.topAuthIPsSuccess?.[0]?.ip;
    if (fb1 && !isPrivateIP(fb1)) {
      const result = await tryGeolocate(fb1);
      if (result) return result;
    }

    // 3. Fallback: first failed auth IP
    const fb2 = snapshot?.metrics?.topAuthIPsFailed?.[0]?.ip;
    if (fb2 && !isPrivateIP(fb2)) {
      const result = await tryGeolocate(fb2);
      if (result) return result;
    }

    return null;
  },
  enabled: !!firewallHostname && !!snapshot,
  staleTime: 1000 * 60 * 30,
});
```

### Mudancas chave

1. **`looksLikeIP`**: Distingue IPs de hostnames DNS para evitar chamada invalida ao ipwho.is
2. **`dns.google/resolve`**: API publica do Google DNS, suporta HTTPS, sem rate limit agressivo, resolve hostnames para IPs
3. **`enabled: !!firewallHostname && !!snapshot`**: Garante que a query so roda quando o snapshot ja carregou, evitando cache de null
4. **queryKey inclui `topAuthIPsFailed`**: Garante re-execucao quando esses dados mudam
5. **`tryGeolocate` helper**: Elimina duplicacao de codigo

### Arquivos modificados

1. `src/pages/firewall/AnalyzerDashboardPage.tsx` - reescrever bloco de geolocalizacao (linhas 218-257)
