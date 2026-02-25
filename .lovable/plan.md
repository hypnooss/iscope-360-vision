

# Corrigir Tooltip na coluna Servicos FortiGuard

## Problema

O tooltip na coluna "Servicos FortiGuard" nao aparece ao passar o mouse sobre o texto "X servico(s)".

## Causa raiz

Ha um `TooltipProvider` redundante envolvendo os tooltips dentro da celula da tabela (linha 405). O app ja possui um `TooltipProvider` global em `App.tsx` (linha 86). O aninhamento duplicado pode causar conflito no gerenciamento de estado dos tooltips do Radix.

## Solucao

Remover o `TooltipProvider` interno na celula da tabela de servicos (linhas 405 e 426), mantendo apenas a estrutura `Tooltip > TooltipTrigger > TooltipContent` que ja funciona com o provider global.

Tambem trocar `asChild` no `TooltipTrigger` por renderizacao direta (sem `asChild`), garantindo que o Radix crie seu proprio elemento wrapper com os handlers de evento corretos.

## Arquivo a modificar

| Arquivo | Alteracao |
|---|---|
| `src/pages/LicensingHubPage.tsx` | Remover `TooltipProvider` interno (linhas 405 e 426); remover `asChild` do `TooltipTrigger` (linha 411) |

## Alteracao especifica

De:
```tsx
<TooltipProvider>
  <div className="space-y-1.5">
    {groupServicesByExpiry(fw.services).map((group, i) => (
      <div key={i} className="flex items-center gap-2">
        <ExpiryBadge ... />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="...">...</span>
          </TooltipTrigger>
          <TooltipContent>...</TooltipContent>
        </Tooltip>
      </div>
    ))}
  </div>
</TooltipProvider>
```

Para:
```tsx
<div className="space-y-1.5">
  {groupServicesByExpiry(fw.services).map((group, i) => (
    <div key={i} className="flex items-center gap-2">
      <ExpiryBadge ... />
      <Tooltip>
        <TooltipTrigger className="text-xs text-muted-foreground cursor-default">
          {group.names.length} servico{group.names.length !== 1 ? 's' : ''}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">{group.names.join(', ')}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  ))}
</div>
```
