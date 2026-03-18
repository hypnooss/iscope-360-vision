

## Plano: Corrigir visibilidade do ScrollDown e ancoragem dos passos do Showcase

### Problemas identificados

1. **ScrollDown não desaparece entre seções**: Os anchor divs do showcase (`showcase-step-1/2/3`) têm altura zero. O `IntersectionObserver` com threshold 0.5 nunca os detecta, então `isSnapped` fica inconsistente -- ora true (pela seção pai), ora false sem motivo claro.

2. **Passo 02 já aparece ao clicar no ScrollDown**: O anchor `showcase-step-2` está em `top: 33.33%` de um container de 400vh, mas o `scrollIntoView` leva o topo do anchor ao topo da viewport. Como o conteúdo sticky já mostra o step 2 nessa posição, o alinhamento está ligeiramente errado.

3. **ScrollDown some no passo 02→03**: Como os anchors não têm altura, o snap observer não consegue rastreá-los e `isSnapped` vira `false`.

### Alterações

**1. `src/components/landing/SteppedShowcase.tsx`** — Dar altura real aos anchors

Trocar os 3 divs de anchor (linhas 379-381) de elementos sem altura para divs com altura de ~33.33% cada, empilhados verticalmente para cobrir os 400vh do container:

```tsx
<div id="showcase-step-1" className="absolute w-full" style={{ top: '0', height: '33.33%' }} />
<div id="showcase-step-2" className="absolute w-full" style={{ top: '33.33%', height: '33.33%' }} />
<div id="showcase-step-3" className="absolute w-full" style={{ top: '66.66%', height: '33.33%' }} />
```

Isso permite que o IntersectionObserver com threshold 0.5 detecte cada passo corretamente.

**2. `src/components/landing/ScrollDown.tsx`** — Ajustar threshold do snap observer

Reduzir o threshold do snap observer de `0.5` para `0.3` para ser mais tolerante com seções de tamanhos variados e com os anchors do showcase. Isso garante que o botão apareça de forma mais confiável quando uma seção está razoavelmente visível, e desapareça apenas quando realmente está entre seções.

