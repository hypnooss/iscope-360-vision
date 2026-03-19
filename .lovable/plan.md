

## Problema

As seções da landing page estão com elementos invadindo seções vizinhas. Isso acontece porque:

1. O componente `Section` (e a seção CTA manual) não têm `overflow-hidden`, permitindo que elementos animados (que iniciam com deslocamento Y de 60-80px) sangrem visualmente para fora do container.
2. A seção CTA usa `py-[120px]` enquanto o padrão é `py-[160px]`, reduzindo o respiro.

## Alterações

**`src/pages/Index.tsx`**

1. Adicionar `overflow-hidden` ao componente `Section` (linha 71) no className da `motion.section`:
   - De: `py-[160px] px-6 ${className}`
   - Para: `py-[160px] px-6 overflow-hidden ${className}`

2. Adicionar `overflow-hidden` na seção CTA manual (linha 462):
   - Já tem `overflow-hidden` -- apenas ajustar o padding de `py-[120px]` para `py-[160px]` para manter consistência com as demais seções.

Essas duas mudanças garantem que nenhum elemento animado vaze visualmente para seções adjacentes.

