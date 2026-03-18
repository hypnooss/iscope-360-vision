
Objetivo: parar o efeito “pisca/some-volta” e tornar o Scroll Down 100% determinístico, baseado em posições exatas da página em vez de heurística de overlap/intersection.

1. Reescrever a lógica do `ScrollDown` para cálculo exato por faixa de scroll
- Em `src/components/landing/ScrollDown.tsx`, remover a regra atual de “sumir enquanto está rolando” (`isScrolling`) e qualquer decisão baseada em overlap/intersection.
- Calcular um mapa fixo de navegação a partir dos `sectionIds`: para cada âncora, ler sua posição absoluta no documento (`window.scrollY + rect.top`).
- Criar faixas exatas usando os pontos médios entre uma âncora e a próxima:
  - antes do meio entre A e B = seção A ativa
  - depois desse meio = seção B ativa
- O botão fica visível apenas quando existir uma seção ativa válida e ela não for a última.
- Resultado: um micro-scroll do mouse não faz o botão piscar; ele só muda quando cruza o limite matemático entre duas seções.

2. Padronizar as âncoras de navegação, não a heurística
- Manter o layout visual das seções como está, mas padronizar os “alvos de navegação” para o cálculo.
- Para as seções comuns, usar o próprio topo da seção como âncora oficial.
- Para o showcase, usar âncoras explícitas e previsíveis, com posições calculáveis dentro do container.

3. Corrigir o showcase com offsets exatos por viewport
- Em `src/components/landing/SteppedShowcase.tsx`, substituir os anchors percentuais “33.33% / 66.66%” por passos alinhados ao comportamento real do bloco sticky.
- Definir offsets dos steps com base em `vh` e no range real dos 3 passos, para que:
  - clique antes do showcase vá ao passo 1
  - clique do passo 1 vá ao passo 2
  - clique do passo 2 vá ao passo 3
- Se necessário, os anchors passam a ser posicionados por valores calculados em pixels a partir da altura da viewport, não por porcentagem solta do container.

4. Recalcular tudo apenas quando necessário
- Recomputar o mapa de posições no mount, no `resize` e após load/layout settle.
- Corrigir também o cleanup do listener de resize no `ScrollDown`, que hoje está inconsistente.

5. Resultado esperado
- O Scroll Down não desaparece “porque encostou no mouse wheel”.
- Ele só aparece/desaparece ao cruzar limites reais entre seções.
- O showcase deixa de pular passo.
- O comportamento fica estável em desktop e acompanha a altura real da viewport.

Arquivos envolvidos
- `src/components/landing/ScrollDown.tsx`
- `src/components/landing/SteppedShowcase.tsx`

Detalhe técnico
```text
anchors absolutos: Y0, Y1, Y2, Y3...
limites: M0=(Y0+Y1)/2, M1=(Y1+Y2)/2...

faixa da seção 0:   [0 .......... M0)
faixa da seção 1:   [M0 ......... M1)
faixa da seção 2:   [M1 ......... M2)

currentIndex = faixa que contém window.scrollY
isVisible = currentIndex válido && !isLastSection
```

Esse modelo elimina o comportamento instável atual porque a visibilidade deixa de depender de animação, debounce, overlap parcial ou interseção ambígua.
