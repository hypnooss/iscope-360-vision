

## Reverter valores do globo + Corrigir zig-zag para eixo X

### Problema
A última alteração mudou `uSize` de `18` para `28`, o que afeta o globo (morph=0) — partículas ficaram enormes no estado globo. Precisamos reverter valores que impactam o globo e aplicar aumentos **apenas no estado sand** via shader.

### Mudanças — `src/components/NetworkAnimation.tsx`

**1. Reverter `uSize` para `18`** (linha 320)
- O aumento de tamanho no sand será feito no shader usando `morphEased`

**2. No vertex shader — aumentar tamanho apenas no sand** (linha ~186-188):
- Inverter o `sizeMultiplier`: em vez de `mix(1.0, 0.5, morphEased)`, usar `mix(1.0, 2.5, morphEased)` — partículas ficam 2.5x maiores apenas no estado sand

**3. Corrigir zig-zag para eixo X** (shader linhas 173-175):
- Mover ondulação do Y para o X, usando profundidade (Z) como driver:
```glsl
float zigzag = sin(aFlatPosition.z * 8.0 + uTime * 1.5) * 0.04
             + sin(aFlatPosition.z * 3.0 - uTime * 0.8) * 0.03;
vec3 flatPos = aFlatPosition + vec3(zigzag, flatNoise * 0.003, 0.0);
```

**4. Achatar posições iniciais JS** (linhas 283-287):
- Remover sinusoidais do Y para eliminar montanhas:
```javascript
const flatY = -0.3 + (Math.random() - 0.5) * 0.015;
```

Nenhum outro valor muda — câmera, scale, rotation, position.y, spread, particle count permanecem iguais.

