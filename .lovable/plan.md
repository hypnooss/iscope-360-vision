

## Ajustes: Profundidade na areia + Reduzir ondulação

### 1. Efeito de profundidade na areia
No estado "areia", as partículas mais distantes da câmera (Z maior) devem ficar mais escuras/transparentes, criando sensação de profundidade. Vou adicionar no vertex shader um fator baseado na posição Z da flat position que reduz o alpha conforme Z aumenta (partículas "mais longe" ficam mais tênues).

Também posso fazer partículas mais distantes serem levemente menores, reforçando a perspectiva.

**No vertex shader** (linhas ~190-192): no cálculo de `alphaMultiplier` no estado areia, multiplicar por um fator baseado em `aFlatPosition.z` — partículas com Z mais negativo (mais distantes) ficam mais transparentes.

### 2. Reduzir ondulação da areia
As setas verdes no print mostram que a variação Y (ondulação senoidal) está alta demais. Vou reduzir as amplitudes dos senos no cálculo de `flatY` (linhas 275-279):
- `sin(flatX * 4.0) * 0.06` → `* 0.02`
- `sin(flatZ * 6.0) * 0.04` → `* 0.015`
- `sin(flatX * 9.0 + flatZ * 5.0) * 0.025` → `* 0.01`
- Random `* 0.03` → `* 0.01`

Também reduzir o noise animado no shader (linha 173) de `flatNoise * 0.02` para `* 0.008`.

### Arquivos
- `src/components/NetworkAnimation.tsx` — reduzir amplitudes de flatY, adicionar depth fade no shader

