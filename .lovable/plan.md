
Objetivo: fazer o Scroll Down desaparecer apenas quando a viewport estiver realmente entre seções, e corrigir a navegação para o showcase não “pular” direto para o passo 02.

Plano

1. Reescrever a lógica de detecção do ScrollDown em `src/components/landing/ScrollDown.tsx`
- Remover a lógica atual baseada em `threshold` + `Set`, porque ela considera várias seções ao mesmo tempo e deixa o botão quase sempre visível.
- Trocar por uma detecção de “seção ativa no centro da viewport”.
- Atualizar `currentIndex` somente quando um item de `sectionIds` cruzar essa faixa central.
- Quando nenhum item estiver nessa faixa, definir o botão como oculto.
- Manter a transição suave com `opacity` + `pointer-events-none`.

2. Corrigir a causa do salto para o passo 02
- Hoje o `currentIndex` pode ficar errado porque múltiplos anchors do showcase intersectam ao mesmo tempo.
- Com a nova lógica centralizada, o clique da seção anterior vai mirar corretamente `showcase-step-1`, em vez de avançar para `showcase-step-2`.

3. Ajustar os anchors do showcase em `src/components/landing/SteppedShowcase.tsx`
- Manter 3 anchors dedicados (`showcase-step-1/2/3`), mas tratá-los como faixas reais e contínuas do container de `400vh`.
- Garantir que cubram todo o showcase sem comportamento ambíguo para o observer.
- Marcar esses anchors como invisíveis e não interativos (`aria-hidden`, `pointer-events-none`), só para navegação/detecção.

4. Refinar o comportamento visual dentro do showcase
- Fazer o Scroll Down continuar visível durante os passos 01 → 02 → 03, desde que a viewport esteja alinhada com um passo.
- Fazer ele sumir apenas nos intervalos reais entre blocos/seções, não no meio de uma transição válida do showcase.

Arquivos envolvidos
- `src/components/landing/ScrollDown.tsx`
- `src/components/landing/SteppedShowcase.tsx`

Detalhe técnico
- A solução mais robusta aqui é usar `IntersectionObserver` com uma faixa estreita no centro da viewport via `rootMargin` (em vez de thresholds amplos).
- Isso resolve os dois problemas ao mesmo tempo:
  - o botão não fica preso visível enquanto várias seções estão parcialmente na tela;
  - o índice ativo deixa de oscilar entre step 01/02/03.

Resultado esperado
- Entre seções: Scroll Down desaparece suavemente.
- Seção alinhada: Scroll Down reaparece suavemente.
- Clique antes do showcase: entra no passo 01.
- Clique do passo 01: vai para o 02.
- Clique do passo 02: vai para o 03.
- O botão só some no showcase se estiver realmente fora de um passo válido.
