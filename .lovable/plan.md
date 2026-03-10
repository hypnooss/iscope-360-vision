

## Plano: Substituir estado vazio do Compliance por card de aviso unificado

### Problema

Quando não existe snapshot de compliance para o tenant selecionado, a página exibe um card de erro ("Erro na análise") + o CommandCentral com zeros. O correto é exibir um único card de aviso no estilo do "Tenant não conectado" (com ícone `AlertTriangle`, borda amarela).

### Mudança

**Arquivo:** `src/pages/m365/M365PosturePage.tsx`

1. **Remover** o card de erro atual (linhas 522-535) que mostra "Erro na análise" quando `error && !data`.

2. **Condicionar** o bloco principal (CommandCentral + filtros + categorias, linhas 559-654) para só renderizar quando `data` existir: `{tenants.length > 0 && data && (...)}`

3. **Adicionar** um novo card de aviso **antes** do bloco principal, visível quando o tenant está selecionado, não está carregando, não há análise em andamento e não há dados:

```tsx
{selectedTenantId && !isLoading && !isAnalysisRunning && !data && (
  <Card className="border-warning/30 bg-warning/5">
    <CardContent className="py-12 text-center">
      <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">
        Nenhum relatório de compliance encontrado
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Este tenant ainda não possui análises de compliance. Execute a primeira análise para avaliar a postura de segurança do ambiente.
      </p>
      <Button onClick={handleRefresh} disabled={isBlocked} className="gap-2">
        {isBlocked ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        Executar Análise
      </Button>
    </CardContent>
  </Card>
)}
```

Isso elimina o card de erro + CommandCentral zerado e exibe um único aviso claro no mesmo estilo visual do card "Tenant não conectado".

