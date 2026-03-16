

## Corrigir densidade, zig-zag e profundidade da areia

### Problemas identificados
1. **Densidade baixa**: Partículas espalhadas em `3.0 x 3.0` — área muito grande para 18k partículas
2. **Zig-zag sumiu**: Amplitudes foram reduzidas demais (0.02, 0.015, 0.01) — quase imperceptíveis
3. **Depth fade muito agressivo**: Multiplicador `0.9` com `smoothstep(-0.5, 1.5)` apaga quase tudo, já que `flatZ` vai de -1.5 a 1.5

### Solução — `src/components/NetworkAnimation.tsx`

**1. Aumentar densidade** — reduzir spread do flatX e flatZ:
- `flatX`: `3.0` → `2.0`  
- `flatZ`: `3.0` → `1.8`

**2. Restaurar zig-zag visível** — aumentar amplitudes:
- `sin(flatX * 4.0) * 0.02` → `* 0.04`
- `sin(flatZ * 6.0) * 0.015` → `* 0.03`
- `sin(flatX * 9.0 + flatZ * 5.0) * 0.01` → `* 0.02`

**3. Suavizar depth fade** — menos agressivo para manter partículas visíveis:
- `depthFade`: multiplicador `0.9` → `0.6`
- `alphaMultiplier`: base `0.5` → `0.7`
- `depthSize`: base `0.4` → `0.5`

