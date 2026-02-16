

# Exibir Informacao de ASN no Card de cada IP

## Contexto

O card do IP `www.taschibra.com.br` (191.252.123.34) mostra 16 portas abertas mas apenas 2 servicos. Sem contexto de ASN/provedor, nao fica claro o motivo da discrepancia (ex: hosting compartilhado com muitas portas de servico).

## O que muda

Adicionar a informacao de ASN (numero + provedor) ao lado do IP no card do ativo, para que o usuario entenda imediatamente a infraestrutura por tras daquele IP.

Exemplo visual no card:

```text
www.taschibra.com.br  191.252.123.34  AS27715 (unknown)
```

Quando o provedor for identificado (ex: Cloudflare), ficaria:

```text
cdn.exemplo.com  104.26.14.188  AS13335 (cloudflare)
```

## Plano Tecnico

### 1. Propagar dados de ASN para o snapshot (Edge Functions)

Os dados de ASN ja existem em `attack_surface_tasks.result.raw_steps.asn_classifier.data`, mas NAO sao copiados para `attack_surface_snapshots.results` durante a consolidacao.

**Arquivos:**
- `supabase/functions/attack-surface-step-result/index.ts` (linhas ~82-92)
- `supabase/functions/agent-task-result/index.ts` (logica equivalente)

Adicionar ao objeto consolidado por IP:

```typescript
results[t.ip] = {
  ports: r.ports || [],
  services: r.services || [],
  // ... campos existentes ...
  asn: r.raw_steps?.asn_classifier?.data || null,  // NOVO
}
```

O campo `asn` tera o formato: `{ asn: "AS27715", provider: "unknown", org: "", is_cdn: false }`

### 2. Adicionar campo `asn` ao modelo `ExposedAsset`

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

Na interface `ExposedAsset` (linha ~345):

```typescript
interface ExposedAsset {
  hostname: string;
  ip: string;
  asn: { asn: string; provider: string; org: string; is_cdn: boolean } | null;  // NOVO
  // ... demais campos
}
```

Na funcao `buildAssets` (linha ~430):

```typescript
assets.push({
  hostname,
  ip,
  asn: result.asn || null,  // NOVO
  // ... demais campos
});
```

### 3. Exibir ASN no card

**Arquivo:** `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` - funcao `AssetCard` (linha ~751-756)

Apos o IP, adicionar o badge de ASN:

```typescript
{/* Row 1: hostname + IP + ASN + risk badge */}
<div className="flex items-center gap-3 flex-wrap">
  <span className="text-base font-semibold truncate">{asset.hostname}</span>
  {asset.hostname !== asset.ip && (
    <span className="text-sm text-muted-foreground font-mono">{asset.ip}</span>
  )}
  {asset.asn?.asn && (
    <Badge variant="outline" className="text-[10px] px-1.5 bg-violet-500/10 text-violet-400 border-violet-500/30 font-mono">
      {asset.asn.asn}
      {asset.asn.provider !== 'unknown' && ` (${asset.asn.provider})`}
    </Badge>
  )}
  <Badge variant="outline" className={cn("text-[10px] ml-auto shrink-0", rc.badge)}>
    {asset.riskLevel}
  </Badge>
</div>
```

O badge usara cor violeta para se distinguir das demais informacoes (laranja=portas, azul=servicos, verde=certificados).

### 4. Tipo na interface de dados

**Arquivo:** `src/hooks/useAttackSurfaceData.ts`

Adicionar `asn` ao tipo `AttackSurfaceIPResult`:

```typescript
export interface AttackSurfaceIPResult {
  // ... campos existentes ...
  asn?: { asn: string; provider: string; org: string; is_cdn: boolean } | null;
}
```

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/attack-surface-step-result/index.ts` | Propagar `asn` na consolidacao |
| `supabase/functions/agent-task-result/index.ts` | Propagar `asn` na consolidacao |
| `src/hooks/useAttackSurfaceData.ts` | Adicionar `asn` ao tipo `AttackSurfaceIPResult` |
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Adicionar `asn` a `ExposedAsset`, extrair em `buildAssets`, exibir no `AssetCard` |

## Nota

Snapshots ja finalizados NAO terao ASN nos resultados. Somente snapshots gerados apos o deploy das Edge Functions terao o campo. Na UI, o badge simplesmente nao aparece quando `asn` e null.

