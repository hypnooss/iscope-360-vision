

## Padronizar empty state do Firewall Compliance

### O que mudar

Substituir o bloco de empty state simples (linhas 546-554 de `FirewallCompliancePage.tsx`) pelo padrão visual dos analisadores M365: um `Card` com classe `glass-card`, ícone centralizado, título em `h3`, descrição e botão "Executar Análise" que chama `handleRefresh` (mesmo comportamento do botão "Executar Ações > Gerar Análise").

### Mudança em `src/pages/firewall/FirewallCompliancePage.tsx`

**Antes** (linhas 546-554):
```tsx
<div className="text-center py-16 text-muted-foreground">
  <p>Nenhuma análise encontrada para este firewall.</p>
  <p className="text-sm mt-2">Execute uma nova análise para ver os resultados.</p>
  <Button className="mt-4" onClick={handleRefresh} disabled={isRefreshing}>
    {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
    Analisar agora
  </Button>
</div>
```

**Depois** (seguindo o padrão M365):
```tsx
<Card className="glass-card">
  <CardContent className="py-12 text-center">
    <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma análise encontrada</h3>
    <p className="text-muted-foreground mb-4">Execute a primeira análise para visualizar o relatório de compliance.</p>
    <Button onClick={handleRefresh} disabled={isRefreshing}>
      {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
      Executar Análise
    </Button>
  </CardContent>
</Card>
```

- Adicionar imports de `Card`, `CardContent` e `Shield` (ícone contextual para firewall compliance).
- O `onClick={handleRefresh}` já é o mesmo handler usado pelo botão "Gerar Análise" do dropdown, garantindo paridade funcional.

### Arquivo
- `src/pages/firewall/FirewallCompliancePage.tsx`

