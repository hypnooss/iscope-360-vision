

# Fix: Geolocation do Firewall no Mapa de Ataques

## Problema

A API `ip-api.com` (plano gratuito) so aceita requisicoes HTTP. Como a aplicacao roda em HTTPS, o navegador bloqueia a chamada como "mixed content". Resultado: `firewallGeo` nunca recebe dados, o ponto do firewall nao aparece no mapa, e as linhas animadas tambem nao.

## Solucao

Trocar a API de geolocalizacao para uma alternativa gratuita que suporta HTTPS. A melhor opcao e `https://ipwho.is/{hostname}`, que:
- Suporta HTTPS gratuitamente
- Aceita tanto IPs quanto hostnames DNS
- Nao requer API key
- Retorna `lat`, `lon` (longitude) no JSON de resposta

## Mudanca

### Arquivo: `src/pages/firewall/AnalyzerDashboardPage.tsx`

Alterar a query de geolocalizacao (linhas 218-228):

**Antes:**
```
fetch(`http://ip-api.com/json/${firewallHostname}?fields=status,lat,lon`)
// json.status !== 'success'
// json.lat, json.lon
```

**Depois:**
```
fetch(`https://ipwho.is/${firewallHostname}`)
// json.success !== true
// json.latitude, json.longitude
```

A resposta da `ipwho.is` tem o formato:
```json
{
  "success": true,
  "latitude": -22.9,
  "longitude": -43.2,
  ...
}
```

Apenas 3 linhas mudam: a URL, o check de sucesso, e os nomes dos campos lat/lon. O resto (AttackMap, animacoes, legenda) ja esta implementado corretamente e vai funcionar assim que `firewallGeo` receber dados validos.

