

## Corrigir tamanho das partículas e proximidade da câmera

### Diagnóstico
1. **Câmera muito longe**: `camera.position.z` vai de 800 para 600 no morph — ainda muito distante. O MazeHQ usa câmera muito mais próxima do plano, fazendo partículas perto da borda inferior ficarem grandes e as do horizonte pequenas.
2. **Partículas pequenas**: `uSize = 18` é insuficiente para a distância atual.
3. **Zig-zag no eixo errado**: O zig-zag está criando ondulações no eixo Y (vertical), mas como a câmera olha quase de frente, essas ondulações são quase invisíveis. Precisa ter amplitude muito maior para ser perceptível na perspectiva atual.

### Solução — `src/components/NetworkAnimation.tsx`

**1. Câmera muito mais perto no estado sand**
- `camera.position.z`: interpolar de `800` para `350` (era 600) — câmera 2x mais perto do plano
- Isso naturalmente faz partículas próximas ficarem enormes e distantes ficarem pequenas (efeito MazeHQ)

**2. Aumentar tamanho base das partículas**
- `uSize`: `18` → `28` — partículas maiores para compensar e ficar visíveis

**3. Aumentar amplitude do zig-zag**
- Amplitudes JS: dobrar novamente (`0.12→0.20`, `0.10→0.18`, `0.06→0.10`)
- Amplitudes shader: `0.04→0.08` e `0.03→0.06` — ondulações mais dramáticas

**4. Ajustar scale para compensar câmera mais perto**
- `sandScale`: `2.5` → `1.8` — como a câmera está mais perto, não precisa de tanto scale (senão as partículas saem da tela)

**5. Reposicionar Y para câmera mais próxima**
- `position.y`: `-0.35` → `-0.25` — ajustar para a nova distância da câmera

