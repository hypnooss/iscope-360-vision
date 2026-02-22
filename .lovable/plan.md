

# Redesign dos Cards de Saude dos Ativos

## Resumo

Ajustar o componente `AssetHealthGrid` para:
1. Cards sem vulnerabilidades ocupam apenas uma linha (compactos)
2. Cards com vulnerabilidades mantem ou aumentam o tamanho vertical
3. Exibir na primeira linha: hostname, IP e AS/ASN

## Mudancas

### 1. AssetHealthGrid - Props e dados

Atualizar a interface `AssetHealthGridProps` para receber `asn` de cada asset:

```
assets: Array<{
  hostname: string;
  ip: string;
  asn?: { asn: string; provider: string; org: string } | null;
  services: Array<unknown>;
  webServices: Array<unknown>;
}>
```

Incluir `asn` no `AssetHealth`:

```
interface AssetHealth {
  ...
  asn: string | null;  // ex: "AS16509 - Amazon"
}
```

### 2. Layout dos cards

**Card COM vulnerabilidades** (worstSeverity != 'ok'):
- Primeira linha: hostname (truncado) | IP (mono) | ASN badge
- Segunda linha: badges de severidade (C, H, M, L) + contagem de servicos

**Card SEM vulnerabilidades** (worstSeverity == 'ok'):
- Layout single-line (horizontal): hostname | IP | ASN | check icon | servicos
- Padding reduzido (py-2 px-3) para ocupar uma unica linha
- Sem quebras verticais

### 3. Formatacao do ASN

Exibir como badge discreto: "AS16509" ou "AS16509 - Amazon" (truncado se longo).
Se nao houver ASN, nao exibir nada.

### Arquivo afetado

| Arquivo | Descricao |
|---------|-----------|
| `src/components/surface/AssetHealthGrid.tsx` | Redesign dos cards + inclusao de ASN |

Nenhum outro arquivo precisa mudar pois o `SurfaceAnalyzerV3Page` ja passa `assets` com o campo `asn` incluso.

