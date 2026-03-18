
Objetivo: parar de tentar “inferir” a transição por altura real de conteúdo e passar a controlar o `Scroll Down` por uma trilha de navegação previsível, separada do layout visual.

Plano

1. Confirmar a causa do bug atual
- O screenshot mostra o `Scroll Down` ainda visível sobre o título da seção seguinte.
- Hoje o `ScrollDown.tsx` decide visibilidade usando:
  - âncoras reais do DOM;
  - midpoint entre seções;
  - uma “comfort zone” percentual.
- Isso continua acoplando o botão à altura variável das seções (`hero` 100vh, outras com `py-[160px]`, showcase 400vh), então a transição nunca fica exata.

2. Trocar a base de cálculo: navegação por slots, não por conteúdo
- Em `src/pages/Index.tsx`, criar uma camada explícita de navegação com âncoras dedicadas para o `ScrollDown`.
- Essas âncoras vão representar “slots” de viewport previsíveis da jornada, independentes da altura visual dos blocos.
- O botão vai usar esses slots para saber:
  - qual etapa está ativa;
  - em qual janela ele pode aparecer;
  - qual é o próximo alvo exato do clique.

3. Separar comportamento visual de comportamento de navegação
- Manter o layout visual atual das seções.
- Mas o `ScrollDown` deixa de usar o topo real de `section` como regra principal.
- Para seções normais, usar marcadores explícitos de entrada/saída.
- Para o showcase, manter marcadores próprios dos steps, alinhados ao scroll sticky.

4. Reescrever a lógica do `ScrollDown`
- Em `src/components/landing/ScrollDown.tsx`, remover a lógica atual de:
  - midpoint solto;
  - “comfort zone” baseada em percentual da próxima seção.
- Substituir por faixas matemáticas explícitas:
  - cada slot terá `start`, `visibleStart`, `visibleEnd` e `nextTarget`;
  - o botão aparece só dentro da janela válida;
  - o botão some nas zonas de transição;
  - o último slot permanece oculto.
- O clique continua indo para a próxima âncora, mas agora sempre para um alvo previsível.

5. Ajustar o showcase para casar com a mesma trilha
- Em `src/components/landing/SteppedShowcase.tsx`, alinhar os anchors `showcase-step-*` aos pontos reais da progressão sticky.
- Garantir que o fluxo seja:
  - antes do showcase → step 1;
  - step 1 → step 2;
  - step 2 → step 3;
  - step 3 → próxima seção.
- Se necessário, recalibrar os offsets `133.33vh / 266.66vh` para os pontos reais da transição interna.

6. Resultado esperado
- O `Scroll Down` não fica mais “boiando” sobre heading/texto em transição.
- Ele não pisca com scroll curto.
- Ele não depende da altura variável do conteúdo.
- Ele aparece só nas janelas corretas e some exatamente entre uma etapa e outra.

Arquivos envolvidos
- `src/components/landing/ScrollDown.tsx`
- `src/pages/Index.tsx`
- `src/components/landing/SteppedShowcase.tsx`

Detalhe técnico
```text
Modelo novo:
- trilha de navegação = slots previsíveis
- cada slot define:
  startY
  visibleStartY
  visibleEndY
  nextAnchorId

Regra:
if scrollY >= visibleStartY && scrollY < visibleEndY:
  show button
else:
  hide button

currentIndex vem do slot ativo, não da altura real do conteúdo.
```
