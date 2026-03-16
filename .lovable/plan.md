

## Corrigir angulação, densidade e zig-zag da areia

### Análise do MazeHQ
O MazeHQ usa um sistema de partículas WebGL customizado com o código bundled em JS (não exposto no HTML). O globo deles é denso e ocupa toda a viewport, mas não tem um estado "sand". A referência que você quer é o **ângulo de perspectiva** — um plano visto de um ângulo raso (quase eye-level), não de cima.

### Problema atual
- `rotation.x = 0.6 rad` (~35°) é inclinação demais — está olhando "de cima para baixo"
- As linhas vermelhas no print mostram uma perspectiva mais rasa, como olhar para um deserto no horizonte: partículas grandes embaixo, diminuindo e sumindo em direção ao topo
- Density: spread `2.0 x 1.8` ainda espalha demais para 18k partículas
- Zig-zag: amplitudes `0.04/0.03/0.02` ainda sutis demais

### Solução — `src/components/NetworkAnimation.tsx`

**1. Angulação mais rasa** (animate loop, linha 374):
- `rotation.x`: `0.6` → `0.35` rad (~20°) — ângulo mais raso, olhando quase de frente para o plano
- `position.y`: aumentar offset para baixo (`-currentSphereRadius * 0.5`) para que a areia comece mais abaixo na tela

**2. Aumentar profundidade Z e comprimir X** (linhas 278-279):
- `flatX`: `2.0` → `1.6` (mais comprimido horizontalmente = mais denso)
- `flatZ`: `1.8` → `4.0` (partículas se estendem muito mais "para longe", criando profundidade)

**3. Restaurar zig-zag visível** (linhas 282-285):
- `sin(flatX * 4.0) * 0.04` → `* 0.06`
- `sin(flatZ * 6.0) * 0.03` → `* 0.05`
- `sin(flatX * 9.0 + flatZ * 5.0) * 0.02` → `* 0.03`
- Random: `0.01` → `0.015`

**4. Ajustar depth fade no shader** para novo range Z (linhas 192-198):
- `smoothstep(-0.5, 1.5, ...)` → `smoothstep(-1.0, 2.0, ...)` para cobrir o novo range Z de -2.0 a 2.0
- Manter multiplicador `0.6` no alpha

**5. Aumentar sand scale** (linha 380):
- `sandScale = currentSphereRadius * 1.2` → `* 1.5` para que o plano ocupe mais da tela

