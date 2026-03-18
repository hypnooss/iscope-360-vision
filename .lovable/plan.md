
Objetivo: parar de “adivinhar” com midpoint solto e transformar o Scroll Down em uma lógica determinística baseada em faixas verticais previsíveis da viewport.

Plano

1. Corrigir a causa real do bug no `ScrollDown`
- Em `src/components/landing/ScrollDown.tsx`, remover a premissa atual que deixa o botão visível sempre que não está na última seção (`isVisible = !isLastSection`).
- Trocar isso por uma regra com duas coisas separadas:
  - qual seção/step está ativo;
  - em quais faixas o botão pode aparecer.
- Assim o botão deixa de ficar permanente sobre o conteúdo.

2. Padronizar a geometria de navegação por viewport
- Em vez de depender do topo “real” de blocos com alturas variáveis, padronizar a camada de navegação da landing em unidades de viewport.
- Para as seções normais da home, definir âncoras previsíveis no início de cada bloco de navegação.
- Para o showcase, manter os 3 steps, mas com offsets exatos baseados em `vh`, alinhados ao sticky scroll de `400vh`.
- Isso atende exatamente ao que você pediu: calcular exibição/sumiço com base no tamanho vertical da tela, não em heurística.

3. Ajustar a estrutura da landing para suportar cálculo exato
- Em `src/pages/Index.tsx`, revisar a estrutura das seções usadas pelo `ScrollDown`.
- Se necessário, introduzir uma camada de “scroll slots”/âncoras dedicadas para navegação, sem estragar o layout visual existente.
- A ideia é padronizar a navegação, não achatar o design inteiro.

4. Reescrever a visibilidade do botão por faixa matemática
- Calcular posições absolutas das âncoras e montar ranges exatos de ativação/ocultação.
- O botão aparece apenas quando o scroll estiver dentro da janela válida da seção ativa.
- O botão some nas zonas de transição entre seções e no final da jornada.
- O clique sempre leva para a próxima âncora exata.

5. Corrigir o showcase para não pular step
- Em `src/components/landing/SteppedShowcase.tsx`, alinhar os anchors dos steps com os pontos reais do scroll-lock.
- Garantir que:
  - antes do showcase → vai para step 1;
  - no step 1 → vai para step 2;
  - no step 2 → vai para step 3.

Arquivos envolvidos
- `src/components/landing/ScrollDown.tsx`
- `src/components/landing/SteppedShowcase.tsx`
- `src/pages/Index.tsx`

Detalhe técnico
```text
Problema atual:
- currentIndex é calculado por midpoint
- isVisible = !isLastSection
=> então o botão praticamente nunca entra em estado “oculto”

Modelo novo:
- anchors absolutos: Y0, Y1, Y2...
- cada anchor ganha uma faixa visível explícita baseada em viewport
- scrollY dentro da faixa = botão aparece
- scrollY fora da faixa = botão some
- último slot = botão sempre oculto
```

Resultado esperado
- O botão não fica sobreposto o tempo todo.
- Ele não pisca com micro-scroll.
- Ele só aparece nas janelas corretas.
- Ele some nas transições reais.
- O showcase deixa de pular etapas.
