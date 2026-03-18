

## Plano: ScrollDown fixo e global na landing page

### Problema atual
O componente `<ScrollDown>` está duplicado 8 vezes dentro de `Index.tsx`, uma em cada seção, cada um apontando manualmente para a próxima seção. Isso causa posicionamento inconsistente entre seções.

### Solução
Criar um único `<ScrollDown>` fixo no rodapé da viewport (`fixed bottom-8`) que:
1. Detecta automaticamente qual seção está visível via `IntersectionObserver`
2. Ao clicar, faz scroll para a **próxima seção** na sequência
3. Se oculta na última seção (`cta`)

### Sequência de seções
```text
hero → problem → real-problem → how-it-works → features → showcase → testimonials → blog → cta (oculto)
```

### Alterações

**1. `src/components/landing/ScrollDown.tsx`** — Reescrever completamente

- Recebe uma prop `sectionIds: string[]` (lista ordenada dos IDs das seções)
- Usa `IntersectionObserver` para rastrear qual seção está visível (threshold ~0.3)
- Mantém estado `currentIndex` — ao clicar, faz scroll para `sectionIds[currentIndex + 1]`
- Quando `currentIndex === sectionIds.length - 1`, esconde o botão com `opacity-0 pointer-events-none`
- Posicionamento: `fixed bottom-8 left-1/2 -translate-x-1/2 z-50`
- Mantém a mesma aparência visual atual (texto "Scroll down" + dot animado)

**2. `src/pages/Index.tsx`** — Simplificar

- Remover todas as 8 instâncias de `<ScrollDown targetId="...">` espalhadas pelas seções
- Adicionar uma única instância no final do JSX, fora de qualquer seção:
```tsx
<ScrollDown sectionIds={['hero','problem','real-problem','how-it-works','features','showcase','testimonials','blog','cta']} />
```
- A seção hero precisa ter `id="hero"` (verificar se já tem)

### Comportamento visual
- O botão fica fixo na parte inferior central da tela
- Transição suave de opacidade ao aparecer/desaparecer
- Na última seção (`cta`), desaparece completamente

