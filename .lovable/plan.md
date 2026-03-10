

## Padronizar espaçamentos e subtítulos no Surface Analyzer

### Alterações

**1. Espaçamento vertical** (`SurfaceAnalyzerV3Page.tsx`, linha 487)
- Trocar `space-y-6` por `space-y-10` para alinhar com Exchange e Firewall Analyzers.

**2. Subtítulo "Exposição dos Serviços"** (`SurfaceAnalyzerV3Page.tsx`, antes da linha 539)
- Adicionar `<h2>` com classes `text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3` (mesmo padrão do "Panorama por Categoria" na linha 530) antes do grid de `TopFindingsList` + `SeverityTechDonut`.

**3. Subtítulo "Detalhamento da Exposição"** (`SurfaceAnalyzerV3Page.tsx`, antes da linha 549)
- Adicionar `<h2>` externo ao card com as mesmas classes de subtítulo.

**4. Remover título interno do AssetHealthGrid** (`AssetHealthGrid.tsx`, linhas 258-267)
- Remover o `<CardHeader>` com "Saúde dos Ativos" e o Badge de contagem.
- Manter apenas o `<Card>` com `<CardContent>` direto (o grid de assets).

