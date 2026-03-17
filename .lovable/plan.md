

## Diagnóstico

Dois problemas identificados:

### 1. Rotação do globo quase imperceptível
`ROTATION_SPEED = 0.000020` resulta em `elapsed * 0.02 rad/s` — cerca de 1 grau por segundo. Praticamente invisível. Precisa ser ~10x mais rápido para parecer com o MazeHQ.

### 2. Sand/morph não visível ao scrollar
O scroll mapping funciona (`0→1` no primeiro viewport height), e o `NetworkAnimation` está fixo com `z-0`. Porém, o `main` tem `z-10`, o que significa que todas as seções com backgrounds opacos (cards, seções escuras) cobrem as partículas. No final da página (CTA), o fundo da seção tapava completamente o efeito de sand. A animação de partículas está rodando corretamente por baixo, mas as seções a escondem visualmente.

## Plano

**Arquivo: `src/components/NetworkAnimation.tsx`**

1. **Aumentar ROTATION_SPEED** de `0.000020` para `0.00015` — rotação visível e suave (~8.6°/s), similar ao MazeHQ.

**Arquivo: `src/pages/Index.tsx`**

2. **Dar ao container fixo do globo `z-10`** e ao `main` manter `z-10` mas garantir que as seções do meio tenham backgrounds semi-transparentes ou que o CTA final tenha background transparente para deixar as partículas sand visíveis por trás. Alternativa mais limpa: colocar o NetworkAnimation com **z-index mais alto que o conteúdo apenas na seção CTA final**, ou tornar o background da seção CTA transparente para que o sand effect transpareça — como no MazeHQ (print 2), onde as partículas são visíveis atrás do conteúdo.

3. **Tornar a seção CTA final com background transparente** (`bg-transparent` em vez de `bg-background`) para que o efeito sand das partículas seja visível como fundo, replicando o visual do MazeHQ.

