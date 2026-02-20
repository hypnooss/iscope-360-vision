

# Corrigir Layout dos Stats Cards para V1

## Problema
O `StatCard` compartilhado (`src/components/StatCard.tsx`) tem layout "titulo em cima, numero embaixo, icone a direita". O V1 (`AttackSurfaceAnalyzerPage`) usa um `StatCard` local com layout "icone grande a esquerda, numero grande + label embaixo".

## Solucao
Substituir o uso do `StatCard` compartilhado no V3 por cards inline que replicam exatamente o layout do V1:

```
[Icone colorido 8x8] | Numero grande (2xl bold)
                      | Label pequeno (xs muted)
```

## Alteracao

**Arquivo:** `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx`

- Remover import do `StatCard` de `@/components/StatCard`
- Adicionar import de `Card, CardContent` de `@/components/ui/card`
- Substituir os 4 `<StatCard>` por 4 cards usando o mesmo padrao do V1:

```tsx
<Card className="glass-card">
  <CardContent className="p-4 flex items-center gap-3">
    <Globe className="w-8 h-8 text-teal-400" />
    <div>
      <p className="text-2xl font-bold">{assetStats.totalAssets}</p>
      <p className="text-xs text-muted-foreground">Ativos Expostos</p>
    </div>
  </CardContent>
</Card>
```

Cada card com seu icone e cor:
- Globe / text-teal-400 / "Ativos Expostos"
- Server / text-blue-400 / "Servicos Detectados"
- ShieldAlert / text-destructive / "CVEs Criticas"
- AlertTriangle / text-warning / "Certificados Expirados"

