

## Efeito de Profundidade na Areia (estilo MazeHQ)

### Problema
O plano de areia está sendo visto quase de frente (câmera olhando reto para Z=0). No MazeHQ, a areia é vista de cima em ângulo — partículas perto da câmera (parte inferior da tela) são grandes e brilhantes, e as distantes (parte superior) são pequenas e desvanecem no horizonte. Isso cria profundidade real.

### Solução

**`src/components/NetworkAnimation.tsx`** — 3 mudanças:

1. **Inclinar o plano de areia no estado sand**: No `animate()`, interpolar `points.rotation.x` para ~0.6 rad (~35°) quando `morph=1`, fazendo a câmera "olhar de cima" para o plano. Também deslocar `points.position.y` para baixo para que a areia fique na metade inferior da tela.

2. **Aumentar spread em Z** para criar mais profundidade: Mudar `flatZ` de `(random-0.5)*1.2` para `(random-0.5)*3.0` — partículas se espalham mais "para longe" da câmera.

3. **Aumentar agressividade do depth fade no shader**: Ajustar o `depthFade` e `depthSize` para que partículas com Z alto (distantes) fiquem bem mais transparentes e menores, criando o gradiente de profundidade visível no MazeHQ.

### Detalhes técnicos

- **Rotation X interpolation** (animate loop): `points.rotation.x = mix(sin(elapsed)*0.08, 0.6, morph)` 
- **Position Y offset**: `points.position.y = mix(0, -currentSphereRadius*0.3, morph)` para baixar a areia
- **flatZ spread**: `1.2` → `3.0`
- **Shader depth fade**: Tornar mais agressivo — `smoothstep(-0.5, 1.5, aFlatPosition.z)` com multiplicador `0.9` em vez de `0.7`

