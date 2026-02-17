

# Corrigir badge ASN para IPs de CDN/Cloud sem numero AS

## Problema

A badge de ASN so aparece quando `asset.asn?.asn` existe (o numero do AS, ex: "AS13335"). Para alguns IPs de CDN como CloudFront/AWS, o objeto `asn` existe com dados de `provider`, `org`, emails e range, mas o campo `asn` (numero) pode estar vazio. Resultado: nenhuma badge aparece.

## Solucao

**Arquivo**: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Alterar a condicao de renderizacao da badge ASN (linha 992) de:

```
asset.asn?.asn && (...)
```

Para:

```
asset.asn && (asset.asn.asn || asset.asn.provider || asset.asn.org) && (...)
```

E ajustar o conteudo da badge para exibir o que estiver disponivel:
- Se tiver `asn.asn` + provider/org: `AS13335 (cloudflare.com)`
- Se tiver apenas provider/org (sem numero): `cloudflare.com` ou `CLOUDFLARENET`
- Se tiver apenas `asn.asn`: `AS13335`

A logica de label fica:

```tsx
const asnLabel = asset.asn.asn || '';
const providerLabel = asset.asn.provider && asset.asn.provider !== 'unknown'
  ? asset.asn.provider
  : asset.asn.org
    ? (asset.asn.org.length > 20 ? asset.asn.org.slice(0, 20) + '...' : asset.asn.org)
    : '';

// Se ambos existem: "AS13335 (cloudflare.com)"
// Se so provider: "cloudflare.com"
// Se so asn: "AS13335"
```

Isso garante que qualquer IP com dados de ASN/provider/org tera a badge visivel.

