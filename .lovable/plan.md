
O motivo de “não ter ficado igual” é simples: nós copiamos o shader, mas o visual da MazeHQ não é “só o shader”.

Hoje a sua página está renderizando um campo de partículas no viewport inteiro, não o sistema visual completo da MazeHQ. Pelo código atual, os principais desvios são estes:

1. Canvas em tela inteira
- Em `src/pages/Index.tsx`, o `NetworkAnimation` está em `fixed inset-0`.
- Isso transforma a animação em fundo global da página toda.
- No print, por isso ela parece um “céu estrelado” atrás do hero inteiro, em vez de um globo centralizado.

2. O shader atual não cria a leitura visual de globo da MazeHQ sozinho
- O código atual desenha todos os pontos com `AdditiveBlending` e alpha por distância.
- Não existe mascaramento forte de profundidade, nem “rim glow” real, nem supressão forte do miolo.
- Resultado: os pontos internos da esfera continuam visíveis e a forma vira uma nuvem espalhada.

3. Faltam camadas que a MazeHQ usa além do GLSL
- Pelo comportamento visual, o efeito final depende de composição:
  - esfera principal
  - halo/atmosfera
  - fade de profundidade
  - enquadramento/escala exatos
  - container/máscara da seção hero
- No seu código atual existe só uma camada WebGL crua.

4. O “copy” feito foi parcial
- O GLSL foi copiado.
- Mas não foram copiados o contexto completo de renderização e composição visual do hero.
- Então tecnicamente houve mudança no código, mas visualmente o resultado continuou errado.

5. O próprio estado atual do código confirma isso
- `NetworkAnimation.tsx` está com shader, textura radial e escala dinâmica.
- Mesmo assim, o print mostra quase o mesmo fundo estrelado.
- Isso indica que o problema não é “faltou colar o vertex shader”; é que a arquitetura visual ainda está diferente da MazeHQ.

O que precisa ser copiado de verdade, sem inventar:

1. Reenquadrar a animação como globo do hero, não fundo da página inteira
- Tirar o uso como background global fixo.
- Colocar o canvas dentro da seção hero, com tamanho e recorte iguais ao da referência.

2. Reproduzir a composição visual completa do globo
- Esfera principal
- camada de halo
- fade de profundidade
- leitura de borda mais brilhante que o centro

3. Ajustar o pipeline, não só os uniforms
- distribuição visível dos pontos
- alpha por profundidade
- supressão do interior
- escala e framing do globo no container

4. Só depois manter o stream/funnel
- O modo `uStream` deve entrar como transição do globo correto.
- Hoje o estado base já está errado, então a transição também herda esse erro.

Plano de implementação correto:
1. Mapear exatamente como a MazeHQ enquadra o globo no hero.
2. Refatorar o `Index.tsx` para o canvas deixar de ser fundo global.
3. Refatorar o `NetworkAnimation.tsx` para copiar a composição visual inteira do globo, e não apenas o shader colado.
4. Preservar `scrollProgress -> uStream` depois que o estado base estiver fiel.
5. Validar primeiro o estado inicial parado do hero; só depois validar rotação e stream.

Em resumo: não ficou igual porque foi copiado o GLSL, mas não foi copiado o sistema visual completo que faz o GLSL parecer um globo na MazeHQ. O que está na sua página hoje é, na prática, um particle field full-screen com as mesmas fórmulas de shader — e isso não basta para reproduzir o resultado visual da referência.
