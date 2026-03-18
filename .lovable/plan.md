

## Plano: ScrollDown visível apenas quando seção está alinhada

### Problema
O botão ScrollDown fica sempre visível, sobrepondo elementos quando o usuário rola manualmente entre seções.

### Solução
Adicionar um estado `isSnapped` que detecta se alguma seção está bem alinhada na viewport (threshold alto ~0.6). Quando o usuário está entre seções (nenhuma com interseção alta), o botão desaparece suavemente. Quando uma seção está bem visível, ele reaparece.

### Alteração — `src/components/landing/ScrollDown.tsx`

- Adicionar estado `isSnapped` (boolean, default `true`)
- Usar um segundo `IntersectionObserver` com threshold `0.5` que:
  - Seta `isSnapped = true` quando qualquer seção está ≥50% visível
  - Seta `isSnapped = false` quando nenhuma seção atinge esse threshold
- Combinar a lógica de visibilidade: botão visível apenas quando `isSnapped && !isLastSection`
- A transição já usa `transition-all duration-500`, então o fade será suave automaticamente

Implementação: ao invés de um segundo observer, reaproveitar o existente adicionando lógica de tracking — manter um `Set` de seções visíveis e atualizar `isSnapped` com base nele.

