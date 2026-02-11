

# Fix: Menu flutuante renderizado atras do conteudo

## Problema

O `HoverCardContent` do Radix UI nao usa Portal por padrao, diferente do `PopoverContent` ou `TooltipContent`. Isso significa que o menu flutuante e renderizado dentro do DOM do sidebar, herdando seu contexto de empilhamento (stacking context). Mesmo com `z-50`, ele nao consegue ultrapassar outros elementos fora desse contexto.

## Solucao

Envolver o `HoverCardContent` em um `HoverCardPrimitive.Portal` dentro do componente `hover-card.tsx`, da mesma forma que o `PopoverContent` ja faz com `PopoverPrimitive.Portal`.

## Alteracoes

### Arquivo: `src/components/ui/hover-card.tsx`

Adicionar o wrapper `HoverCardPrimitive.Portal` ao redor do `HoverCardPrimitive.Content`, igual ao padrao usado em `popover.tsx`:

```tsx
const HoverCardContent = React.forwardRef<...>(
  ({ className, align = "center", sideOffset = 4, ...props }, ref) => (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn("z-50 w-64 rounded-md border bg-popover p-4 ...", className)}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
);
```

Isso faz com que o conteudo do HoverCard seja renderizado no `document.body`, fora de qualquer stacking context do sidebar, resolvendo definitivamente o problema de sobreposicao.

### Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/components/ui/hover-card.tsx` | Envolver Content com Portal |

Nenhuma outra alteracao necessaria -- o `z-50` ja presente no className sera suficiente quando o elemento estiver no root do DOM.

