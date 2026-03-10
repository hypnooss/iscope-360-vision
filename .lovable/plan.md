

## Remover Card e manter mapa direto

Concordo. O Card é desnecessário agora. Vou remover o wrapper `Card`/`CardContent` e manter o mapa diretamente abaixo do heading, com bordas arredondadas e overflow hidden aplicados diretamente na div do mapa.

### Alteração em `AnalyzerDashboardPage.tsx` (linhas 661-678)

Substituir:
```tsx
<Card className="glass-card cursor-pointer hover:border-primary/50 transition-colors" onClick={...}>
  <CardContent className="p-4">
    <div className="max-h-[200px] overflow-hidden rounded-md ...">
      <AttackMap ... />
    </div>
  </CardContent>
</Card>
```

Por:
```tsx
<div className="max-h-[200px] overflow-hidden rounded-lg border border-border/50 opacity-90 group-hover:opacity-100 transition-opacity cursor-pointer"
  onClick={() => setShowAttackMap(true)}>
  <AttackMap ... />
</div>
```

### Arquivo
- `src/pages/firewall/AnalyzerDashboardPage.tsx`

