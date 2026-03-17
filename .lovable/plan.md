
Objetivo: substituir o hero atual por uma implementação muito mais fiel ao hero de https://mazehq.com, usando o que já foi observado da referência real e parando de “inventar” comportamento visual.

O que eu confirmei
- A referência correta é `mazehq.com`.
- O hero real usa um canvas Three.js em tela cheia dentro de um layer separado (`.s-gfx`) e o texto fica por cima.
- O globo ocupa quase toda a altura visível do hero, fica centralizado e vazando para baixo.
- Há hotspots/UI extras fora do canvas, mas o núcleo visual é: fundo escuro, globo enorme de partículas, texto central, logos na base e indicador de scroll.
- Seu código atual já usa Three.js, mas ainda está longe da composição do site:
  - canvas não é full-screen/fixed
  - globo está pequeno e “contido” num box
  - densidade está baixa para o efeito
  - falta o “peso” visual do blob esférico
  - header/copy/layout não seguem a hierarquia visual da referência

Plano de implementação
1. Refazer a composição do hero no `Index.tsx`
- Trocar o wrapper atual do globo por uma camada dedicada de fundo em tela cheia.
- Fazer o hero seguir a mesma hierarquia:
  - layer de background WebGL
  - conteúdo central sobreposto
  - faixa inferior com logos/linhas decorativas
  - scroll hint no rodapé
- Ajustar largura, altura e offsets para o globo aparecer gigante atrás do título, não como um elemento encaixado.

2. Reescrever o `NetworkAnimation.tsx` para aproximar o blob da Maze
- Manter Three.js puro, sem mudar stack.
- Substituir a lógica atual por uma versão mais fiel ao que foi observado:
  - mais partículas
  - esfera bem maior
  - distribuição densa com contorno muito evidente
  - gradiente frio com concentração magenta no quadrante inferior direito
  - transparência interna maior e borda mais brilhante
  - rotação muito sutil
  - animação orgânica leve, sem deformação exagerada por scroll
- Remover a transformação “stream” atual, porque ela desvia do visual da referência.

3. Ajustar câmera, escala e enquadramento
- Aumentar o campo visual útil do globo no viewport desktop.
- Posicionar a câmera e a escala para o círculo preencher boa parte da tela como na referência.
- Garantir comportamento consistente em 1362x856 e adaptar para mobile sem quebrar o enquadramento.

4. Aproximar tipografia e espaçamento do hero
- Reorganizar o bloco textual para ficar visualmente centrado sobre o globo.
- Reduzir interferências do header sticky atual no topo do hero.
- Ajustar pesos, line-height, tracking e largura do texto para a leitura “por cima” do globo ficar semelhante à referência.

5. Replicar os elementos auxiliares visuais do hero
- Adicionar/ajustar logos de clientes na base do hero.
- Inserir linhas/pontos decorativos discretos para lembrar a malha visual inferior da referência.
- Refinar o indicador “Scroll down”.

6. Fazer a implementação em etapas de baixo risco
- Etapa A: composição/layout do hero
- Etapa B: novo globo
- Etapa C: base com logos/linhas
- Etapa D: responsividade e acabamento

Resultado esperado
- O hero deixa de parecer “um canvas com partículas” e passa a parecer “um clone visual do hero da Maze”.
- O globo vira o elemento dominante da dobra inicial.
- O texto, header e base passam a conviver com o canvas do mesmo jeito que na referência.

Detalhes técnicos
- Arquivos principais:
  - `src/pages/Index.tsx`
  - `src/components/NetworkAnimation.tsx`
  - possivelmente `src/components/Header.tsx` para o comportamento visual no topo
- Estratégia:
  - manter `three`
  - não depender de copiar bundle minificado externo
  - portar a composição observável do DOM/CSS e reconstruir o shader/comportamento para ficar visualmente fiel
- Ajustes-chave no WebGL:
  - aumentar contagem de partículas
  - revisar alpha por profundidade e rim glow
  - recalibrar point size, scale e perspective
  - separar melhor “core”, “rim” e “halo”

Risco principal
- O código fonte produtivo da Maze está minificado, então “copiar literal” no sentido de colar o bundle deles não é viável/seguro aqui.
- O caminho correto é reproduzir fielmente a composição observada e portar o comportamento visual no nosso stack, sem continuar com a lógica atual que já se afastou da referência.

Quando você aprovar, eu implemento exatamente nessa ordem para reduzir retrabalho e te entregar primeiro o hero visualmente alinhado, antes de mexer no restante da landing.
