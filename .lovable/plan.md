

# Corrigir Exibicao do Badge de ASN no AssetHealthGrid (V3)

## Problema

A funcao `formatAsn` no V3 retorna `null` se o campo `asn.asn` (numero AS) estiver vazio, mesmo quando `provider` ou `org` possuem dados validos. Na V1, a logica e mais completa: mapeia nomes internos de provider para dominios amigaveis (ex: `aws_cloudfront` -> `aws.com`) e exibe o provider/org como fallback.

## Solucao

Reescrever a funcao `formatAsn` em `src/components/surface/AssetHealthGrid.tsx` para replicar a logica da V1:

1. Adicionar o mapa `PROVIDER_DOMAINS` (cloudflare, aws, azure, etc.)
2. Aceitar assets que tenham `provider` ou `org`, mesmo sem numero AS
3. Formatar como `AS16509 (aws.com)` quando ambos existem, ou apenas `aws.com` / `Tres Pontas In...` quando so ha provider/org

### Detalhes tecnicos

**Arquivo**: `src/components/surface/AssetHealthGrid.tsx`

**Mudanca na funcao `formatAsn` (linhas 37-45)**:

```typescript
const PROVIDER_DOMAINS: Record<string, string> = {
  'cloudflare': 'cloudflare.com', 'akamai': 'akamai.com', 'fastly': 'fastly.com',
  'aws_cloudfront': 'aws.com', 'aws': 'aws.com', 'azure': 'microsoft.com',
  'google_cloud': 'google.com', 'incapsula': 'imperva.com', 'sucuri': 'sucuri.net',
  'stackpath': 'stackpath.com', 'oracle': 'oracle.com',
  'digitalocean': 'digitalocean.com', 'hetzner': 'hetzner.com',
  'vultr': 'vultr.com', 'ovh': 'ovh.com',
};

function formatAsn(asn?: { asn: string; provider: string; org: string } | null): string | null {
  if (!asn) return null;
  const asnNum = asn.asn || '';
  const raw = asn.provider && asn.provider !== 'unknown' ? asn.provider : '';
  const friendly = raw ? (PROVIDER_DOMAINS[raw] || raw) : '';
  const providerLabel = friendly || (asn.org
    ? (asn.org.length > 20 ? asn.org.slice(0, 20) + '...' : asn.org)
    : '');
  if (!asnNum && !providerLabel) return null;
  if (asnNum && providerLabel) return `${asnNum} - ${providerLabel}`;
  return asnNum || providerLabel;
}
```

Isso garante que assets como os da AWS (que tem `provider: 'aws_cloudfront'` mas podem nao ter `asn.asn`) exibam "aws.com" no badge, igualando o comportamento da V1.

