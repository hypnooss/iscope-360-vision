

## Plano: Correção exata da escala e parâmetros do MazeHQ

### Problema
O globo aparece como pontos espalhados porque a escala `0.75 * 280 = 210` faz a esfera ter diâmetro 420 unidades, enquanto o viewport visível na camera (FOV 45, z=400) é apenas ~331 unidades de altura. A esfera transborda a tela e perde a forma reconhecível.

Comparando com o screenshot do MazeHQ: o globo preenche ~80% do viewport, mas mantém forma esférica clara com bordas definidas.

### Correções em `src/components/NetworkAnimation.tsx`

1. **Escala dinâmica baseada no viewport** (como MazeHQ faz):
   - Calcular `scaleFactor` baseado na menor dimensão do container
   - Fórmula: `scaleFactor = Math.min(containerWidth, containerHeight) * 0.75`
   - Aplicar no resize: `points.scale.setScalar(scaleFactor * 0.28)` para que o globo ocupe ~70% do viewport
   - Isso substitui o hardcoded `SCALE_FACTOR * 280`

2. **Rotação mais lenta** -- MazeHQ usa rotação muito suave:
   - `ROTATION_SPEED` de `0.08` para `0.02`

3. **`uScale` dinâmico** -- no resize, atualizar `uniforms.uScale.value` proporcional ao scaleFactor para manter o noise displacement proporcional

4. **`uPixelRatio` no resize** -- atualizar junto com o resize (caso o usuário mova entre monitores)

5. **Sem outras mudanças** -- shaders, uniforms de cor, atributos e lógica de stream já estão exatamente iguais ao MazeHQ

