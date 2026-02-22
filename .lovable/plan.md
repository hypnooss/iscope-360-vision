
# Adicionar Tooltip Rico de RDAP nos Badges de IP e ASN

## Problema

Na V1, ao passar o mouse sobre o badge de IP, um tooltip exibia dados RDAP completos (Range, abuse-c, owner, ownerid, responsible, emails de abuse/tecnico, pais com bandeira). Na V3, esses dados sao descartados porque:

1. A interface `ExposedAsset` da V3 nao inclui os campos RDAP (`abuse_email`, `tech_email`, `ip_range`, `owner`, `ownerid`, `responsible`, `abuse_handle`, `country`)
2. O `AssetHealthGrid` achata o ASN para uma string via `formatAsn()`, perdendo o objeto original

## Solucao

### 1. Expandir a interface ExposedAsset na V3

**Arquivo**: `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` (linha 161)

Adicionar os campos RDAP ao tipo do `asn`:

```typescript
asn: {
  asn: string; provider: string; org: string; is_cdn: boolean;
  country?: string; abuse_email?: string; tech_email?: string;
  ip_range?: string; owner?: string; ownerid?: string;
  responsible?: string; abuse_handle?: string;
} | null;
```

Esses campos ja estao presentes no `result.asn` do snapshot (V1 ja os consome com `(result as any).asn`), entao nenhuma mudanca no `buildAssets` e necessaria.

### 2. Refatorar AssetHealthGrid para preservar o objeto ASN completo

**Arquivo**: `src/components/surface/AssetHealthGrid.tsx`

- Alterar a interface `AssetHealth` para guardar o objeto ASN completo (`asnRaw`) alem do label formatado (`asn: string`)
- Expandir o tipo do `asn` na interface `AssetHealthGridProps` para incluir os campos RDAP
- Criar o componente `IpTooltipBody` (replicando a V1) que renderiza Range, abuse-c, owner, ownerid, responsible, emails
- Envolver os badges de IP e ASN com `Tooltip` + `TooltipContent` contendo o `IpTooltipBody`

### 3. Componente IpTooltipBody

Replicar a estrutura da V1 (`AttackSurfaceAnalyzerPage.tsx` linhas 937-988):

- AS number + org name
- Pais com bandeira (usando `flag-icons`)
- Range de IP
- Separador + grid com abuse-c, owner, ownerid, responsible
- Separador + emails de abuse e tecnico

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` | Adicionar campos RDAP a interface `ExposedAsset.asn` (linha 161) |
| `src/components/surface/AssetHealthGrid.tsx` | Expandir `AssetHealthGridProps.asn` com campos RDAP; preservar objeto ASN raw no `healthData`; criar `IpTooltipBody`; envolver badges de IP e ASN com tooltips |

Os tooltips aparecerao tanto no badge de IP quanto no de ASN, ambos mostrando os mesmos dados RDAP do ativo (Range, owner, abuse, etc.), ja que esses dados pertencem ao IP/bloco e nao apenas ao AS number.
