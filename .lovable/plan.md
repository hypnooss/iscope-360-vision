

## Corrigir efeito sand — remover zig-zag visível, usar ruído orgânico

### Problema
O zig-zag lateral (`sin(aFlatPosition.z * 8.0)`) está criando faixas/listras horizontais visíveis no estado sand. Isso acontece porque a função seno cria padrões regulares e repetitivos que deslocam grupos inteiros de partículas na mesma direção, formando "linhas" artificiais.

O MazeHQ não usa zig-zag — usa partículas distribuídas aleatoriamente num plano com **movimento sutil via noise** (ruído Perlin/Simplex), que é orgânico e não forma padrões visíveis.

### Solução — `src/components/NetworkAnimation.tsx`

**1. Remover zig-zag do shader** (linhas 173-175):
Substituir as funções `sin()` por ruído 2D sutil que já existe no shader (`snoise2d`):
```glsl
float flatNoise = snoise2d(vec2(aFlatPosition.x * 0.5 + uTime * 0.1, aFlatPosition.z * 0.5));
float flatNoiseX = snoise2d(vec2(aFlatPosition.z * 0.8 + uTime * 0.08, aFlatPosition.x * 0.3));
vec3 flatPos = aFlatPosition + vec3(flatNoiseX * 0.015, flatNoise * 0.003, 0.0);
```

Isso usa noise orgânico para movimentação lateral sutil em vez de senos repetitivos — sem padrões visíveis, apenas partículas que "respiram" suavemente.

**2. Nenhuma outra mudança** — globo, câmera, scale, tamanhos permanecem iguais.

