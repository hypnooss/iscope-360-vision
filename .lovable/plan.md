

# Unificar indicador de atualização no card "Scan em andamento"

## Objetivo

Remover o botão separado "Atualizando..." do header e integrar a funcionalidade de refresh manual diretamente no card de progresso "Scan em andamento" que já existe. Assim o usuário tem um único elemento visual durante o scan.

## Mudancas

### Arquivo: `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx`

**1. Remover o botão "Atualizando..."** (linhas 1267-1278)

Eliminar completamente o bloco:
```tsx
{isRunning && (
  <Button size="sm" variant="outline" ...>
    <Loader2 ... /> Atualizando...
  </Button>
)}
```

**2. Adicionar botão de refresh no card de progresso** (linhas 1283-1296)

Dentro do card "Scan em andamento", adicionar um botão pequeno de refresh ao lado do texto de progresso. O card passa a ser:

```tsx
{isRunning && progress && (
  <Card className="glass-card border-teal-500/30">
    <CardContent className="p-4">
      <div className="flex items-center gap-3 mb-2">
        <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
        <span className="text-sm font-medium">Scan em andamento...</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">
            {progress.done} de {progress.total} IPs processados
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-teal-400 hover:text-teal-300"
            onClick={() => refetchRunning()}
            disabled={isRefetchingRunning}
          >
            <Loader2 className={cn("w-3 h-3", isRefetchingRunning && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>
      <Progress value={progress.percent} className="h-2" />
    </CardContent>
  </Card>
)}
```

O icone de loading so gira quando `isRefetchingRunning` esta ativo, dando feedback visual claro ao usuario.

## Resumo

| Arquivo | Acao |
|---|---|
| `src/pages/external-domain/AttackSurfaceAnalyzerPage.tsx` | Remover botao "Atualizando" do header; adicionar botao "Atualizar" dentro do card de progresso |
