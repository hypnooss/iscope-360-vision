
# Adicionar botao "Atualizando..." na pagina de Agendamentos

## Objetivo

Adicionar o mesmo botao de refresh visual usado nas paginas de Execucoes, mostrando "Atualizando..." com icone girando quando ha polling ativo, seguindo o padrao existente.

## Alteracoes

### Arquivo: `src/pages/admin/SchedulesPage.tsx`

1. **Imports**: Adicionar `Button` de `@/components/ui/button`, `RefreshCw` de `lucide-react`, e `cn` de `@/lib/utils`

2. **Refetch manual**: Extrair `refetch` da query `admin-schedules`

3. **Botao no header**: Transformar o bloco do titulo em um `flex` com o botao alinhado a direita, seguindo o mesmo padrao das paginas de Execucoes:

```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-foreground">Agendamentos</h1>
    <p className="text-muted-foreground mt-1">Painel centralizado de agendamentos de analise</p>
  </div>
  <Button onClick={() => refetch()} variant="outline" size="sm">
    <RefreshCw className={cn("w-4 h-4 mr-2", "animate-spin")} />
    Atualizando...
  </Button>
</div>
```

O icone ficara sempre girando (ja que o `refetchInterval` esta sempre ativo) e o texto sera "Atualizando...", indicando visualmente que a pagina se atualiza sozinha. Clicar no botao forca um refetch imediato.

| Arquivo | Alteracao |
|---|---|
| `src/pages/admin/SchedulesPage.tsx` | Adicionar botao "Atualizando..." no header da pagina |
