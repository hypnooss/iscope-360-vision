

## Correção: Empty state do Surface Analyzer (Domínio Externo > Analyzer)

O empty state atual usa `glass-card` com ícone `Radar` opaco e texto neutro. Precisa seguir o padrão amber/warning.

### Alteração em `src/pages/external-domain/SurfaceAnalyzerV3Page.tsx` (linhas 477-485)

Substituir o bloco atual por:

```tsx
<Card className="border-warning/30 bg-warning/5">
  <CardContent className="py-10 text-center max-w-md mx-auto">
    <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
    <h3 className="text-base font-semibold mb-1">Nenhuma análise encontrada</h3>
    <p className="text-sm text-muted-foreground mb-5">
      Execute uma análise para visualizar os ativos expostos na internet.
    </p>
    <Button onClick={() => setScanDialogOpen(true)} disabled={!isSuperRole}>
      <Play className="w-4 h-4 mr-2" /> Executar Análise
    </Button>
  </CardContent>
</Card>
```

Todos os imports necessários (`AlertTriangle`, `Card`, `CardContent`, `Button`, `Play`) já existem no arquivo.

