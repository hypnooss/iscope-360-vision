

## Problema identificado

A seção Hero funciona perfeitamente porque usa `animate="visible"` — dispara no momento do carregamento da página. As demais seções usam `whileInView` com `margin: '500px'`, o que faz a animação disparar quando o elemento ainda está **500px abaixo da tela**. Com duração de 2.4s, quando o usuário chega na seção rolando, a animação já está quase terminada — por isso você só vê "o final" do movimento.

## Solução

Trocar a estratégia de disparo: em vez de `margin` (que dispara antes do elemento aparecer), usar `amount: 0.2` — que dispara quando 20% do elemento já está visível na tela. Isso garante que o usuário **já está olhando** para a seção quando a animação começa.

Além disso, reduzir os valores exagerados de teste para valores finais equilibrados:
- Deslocamentos: 60-80px (visíveis, mas não exagerados)
- Duração: 0.8s (perceptível sem ser lento)

## Alterações

**`src/pages/Index.tsx`**

1. **Section component (linha 69)**: trocar `margin: '500px'` por `amount: 0.2`
2. **Container stagger dos testimonials (linha ~468)**: mesma troca
3. **Variants (linhas 22-54)**: restaurar valores equilibrados:
   - `fadeUp`: y: 60
   - `fadeLeft`/`fadeRight`: x: 60
   - `scaleIn`: scale: 0.85
   - `fadeBlur`: blur: 8px, y: 40
   - `fadeUpScale`: y: 80, scale: 0.92
4. **Reveal duration (linha 84)**: de 2.4s para 0.8s

