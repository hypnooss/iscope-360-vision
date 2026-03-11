

## Corrigir 3 empty states para padrão amber/warning

### Alterações

**1. `src/pages/firewall/AnalyzerDashboardPage.tsx`** (linhas 716-721)
- Já tem `Card`, `CardContent`, `AlertTriangle` importados
- Substituir o `<Alert>` por card warning:
```tsx
<Card className="border-warning/30 bg-warning/5">
  <CardContent className="py-10 text-center max-w-md mx-auto">
    <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
    <h3 className="text-base font-semibold mb-1">Nenhuma análise encontrada</h3>
    <p className="text-sm text-muted-foreground mb-5">Execute a primeira análise para ativar os insights de segurança.</p>
    <Button onClick={handleTrigger} disabled={triggering || isRunning}>
      <Play className="w-4 h-4 mr-2" /> Executar Análise
    </Button>
  </CardContent>
</Card>
```

**2. `src/pages/m365/M365AnalyzerDashboardPage.tsx`** (linhas 761-770)
- Já tem `Card`, `CardContent` importados; adicionar `AlertTriangle` ao import de lucide
- Substituir `glass-card` + `Radar` por:
```tsx
<Card className="border-warning/30 bg-warning/5">
  <CardContent className="py-10 text-center max-w-md mx-auto">
    <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
    <h3 className="text-base font-semibold mb-1">Nenhuma análise encontrada</h3>
    <p className="text-sm text-muted-foreground mb-5">Execute a primeira análise para ativar o radar de incidentes.</p>
    <Button onClick={handleTrigger} disabled={triggering}>
      <Play className="w-4 h-4 mr-2" /> Executar Análise
    </Button>
  </CardContent>
</Card>
```

**3. `src/pages/external-domain/ExternalDomainCompliancePage.tsx`** (linhas 682-690)
- Adicionar imports: `AlertTriangle` (lucide), `Card`, `CardContent` (ui/card)
- Substituir `div` simples por:
```tsx
<Card className="border-warning/30 bg-warning/5">
  <CardContent className="py-10 text-center max-w-md mx-auto">
    <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-3" />
    <h3 className="text-base font-semibold mb-1">Nenhuma análise encontrada</h3>
    <p className="text-sm text-muted-foreground mb-5">Execute a primeira análise para visualizar o relatório de compliance.</p>
    <Button onClick={handleRefresh} disabled={isRefreshing}>
      {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
      Executar Análise
    </Button>
  </CardContent>
</Card>
```

### Arquivos
- `src/pages/firewall/AnalyzerDashboardPage.tsx`
- `src/pages/m365/M365AnalyzerDashboardPage.tsx`
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx`

