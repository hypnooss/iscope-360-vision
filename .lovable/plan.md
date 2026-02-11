
# Fix: Menu flutuante do sidebar se misturando com o conteudo

## Problema

Os menus flutuantes (HoverCard) que aparecem ao passar o mouse sobre os modulos no sidebar colapsado estao sendo renderizados atras do conteudo da pagina, causando sobreposicao visual.

## Causa

O `HoverCardContent` nao possui uma classe de `z-index` suficientemente alta. O conteudo principal da pagina acaba ficando por cima do menu flutuante.

## Solucao

Adicionar `z-50` ao className de ambos os `HoverCardContent` (ModuleButton e AdminButton) no arquivo `src/components/layout/AppLayout.tsx`.

## Alteracoes

### Arquivo: `src/components/layout/AppLayout.tsx`

Duas linhas afetadas:

1. **Linha ~336** (ModuleButton HoverCardContent): adicionar `z-50` ao className
2. **Linha ~458** (AdminButton HoverCardContent): adicionar `z-50` ao className

Antes:
```
className="w-auto min-w-[200px] p-2 bg-sidebar border-sidebar-border shadow-lg"
```

Depois:
```
className="z-50 w-auto min-w-[200px] p-2 bg-sidebar border-sidebar-border shadow-lg"
```
