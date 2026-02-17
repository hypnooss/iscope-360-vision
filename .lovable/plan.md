

# Corrigir posicionamento do tooltip (renderizar via Portal)

## Problema

O tooltip do badge "+N" aparece posicionado sobre o card errado. Isso acontece porque o componente `TooltipContent` em `src/components/ui/tooltip.tsx` renderiza o conteudo inline (dentro do DOM do card), sem usar um Portal. Containers com `overflow: hidden` ou posicionamento relativo fazem o tooltip ficar preso ao contexto do card pai, resultando em posicao incorreta.

## Solucao

Adicionar `TooltipPrimitive.Portal` no componente compartilhado `TooltipContent`. Isso garante que o tooltip seja renderizado na raiz do DOM (`document.body`), eliminando problemas de posicionamento causados por containers intermediarios.

## Mudanca

**Arquivo:** `src/components/ui/tooltip.tsx`

Envolver `TooltipPrimitive.Content` com `TooltipPrimitive.Portal`:

```text
Antes:
  <TooltipPrimitive.Content ... />

Depois:
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content ... />
  </TooltipPrimitive.Portal>
```

Esta e uma correcao global que beneficia todos os tooltips do sistema, nao apenas o badge "+N".

Nenhum outro arquivo precisa ser alterado.

