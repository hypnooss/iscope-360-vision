

## Replicar o Globo da Maze — Baseado em Análise Visual Real

### Diferenças Identificadas (Screenshot vs Screenshot)

O globo atual tem 3 problemas fundamentais comparado ao da Maze:

1. **Densidade insuficiente** — As partículas são visíveis individualmente. No Maze, a densidade é tão alta que forma uma textura "granulada" quase sólida.

2. **Efeito de rim/silhueta fraco** — No Maze, o interior da esfera é quase invisível (se funde com o fundo escuro), e toda a definição visual vem da **borda brilhante**. No nosso, o centro tem alpha alto demais e a borda não se destaca.

3. **Gradiente direcional ausente** — No Maze, o cyan se concentra na parte superior-esquerda e o magenta na parte inferior-direita, criando um gradiente diagonal claro. No nosso, a mistura é uniforme.

### Mudanças em `src/components/NetworkAnimation.tsx`

**1. Aumentar partículas para 25.000 e ajustar tamanhos**
- `PARTICLE_COUNT = 25000`
- `baseSize: 0.3 + Math.random() * 0.5` (partículas um pouco maiores para preencher)

**2. Aumentar raio da esfera**
- `sphereRadius = Math.min(w, h) * 0.65` (era 0.55 — esfera maior para ocupar mais viewport)

**3. Reescrever a lógica de cor completamente**

O segredo do Maze é: o interior é quase invisível, e o brilho vem inteiramente da borda (efeito Fresnel).

```text
Para cada partícula:
  edgeFactor = 1 - abs(nz)  // 0=centro, 1=borda (Fresnel)
  
  // Gradiente direcional: posição 3D determina cor
  // Top-left = cyan, Bottom-right = magenta
  diagonalMix = clamp((-x + y) / (2 * sphereRadius) + 0.5, 0, 1)
  
  Cor = lerp(Magenta(180, 50, 200), Cyan(30, 210, 230), diagonalMix)
  
  // CENTRO (edgeFactor < 0.6): quase invisível
  alpha = edgeFactor * 0.15  // max 0.09 no centro morto
  
  // BORDA (edgeFactor >= 0.6): brilho intenso
  rimIntensity = (edgeFactor - 0.6) / 0.4  // 0..1
  alpha = 0.2 + rimIntensity * 0.8  // até 1.0
  
  // Depth fade: back face muito mais escura
  alpha *= (0.1 + normalizedZ * 0.9)
```

**4. Mais partículas atmosféricas nas bordas**
- 15% das partículas com `radiusMul` até 1.12 (era 10% até 1.08)
- Partículas atmosféricas recebem cor de borda (cyan/magenta) com alpha baixo

**5. Back face quase invisível**
- `normalizedZ < 0.25`: alpha máximo de 0.02 (praticamente zero)

**6. Remover o sizeBoost do centro** — no Maze as partículas são uniformes em tamanho

### Resultado Esperado
Uma esfera onde o interior se funde com o fundo escuro e toda a definição visual vem de um rim brilhante com gradiente diagonal de cyan para magenta, com partículas dispersas formando um halo atmosférico sutil.

### Arquivo afetado
- `src/components/NetworkAnimation.tsx`

