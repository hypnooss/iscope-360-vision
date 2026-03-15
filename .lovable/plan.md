

## Ajustes na Esfera: Densidade, Tamanho e Cores Laterais

### Problemas (comparando prints)

1. **Pontos frontais muito grandes** — no Maze os pontos são uniformemente pequenos e densos. Nosso `frontSizeMul` de até 1.75x e `baseSize` de até 2.6 gera pontos enormes na frente.
2. **Pouca densidade aparente na frente** — paradoxalmente, pontos grandes ocupam mais espaço visual mas parecem "menos". Pontos menores e mais numerosos criam a textura densa do Maze.
3. **Cores dinâmicas afetam a face frontal** — atualmente `atan2(z, x)` distribui cores pelo ângulo horizontal incluindo a frente. No Maze, a face frontal é predominantemente teal/cyan uniforme, e as cores cyan/magenta aparecem nas **laterais** (silhueta/borda).

### Mudanças em `NetworkAnimation.tsx`

**1. Reduzir tamanho dos pontos (especialmente frontais):**
- Remover `frontSizeMul` — sem multiplicador extra para frente
- Reduzir `baseSize` range: 0.3-0.8 (70%), 0.8-1.2 (25%), 1.2-1.5 (5%)
- Size final: `Math.max(0.2, p.baseSize * scale * 0.9)` — escala menor

**2. Cores baseadas na silhueta (laterais) em vez do ângulo horizontal:**
- Calcular `silhouette` = quão perto a partícula está da borda visível do círculo (usando a distância 2D projetada do centro vs raio projetado)
- Partículas no **centro da face** → teal uniforme (20, 184, 166)
- Partículas na **borda/silhueta** → gradiente cyan → magenta baseado no ângulo vertical
- Transição suave usando `edgeFactor = distância_do_centro / raio_projetado`
- Quanto mais na borda, mais a cor varia; quanto mais no centro, mais teal puro

**3. Manter profundidade e alpha como está** — o contraste frente/trás está bom, apenas o tamanho e cor precisam ajuste.

### Arquivo

| Arquivo | Mudança |
|---|---|
| `src/components/NetworkAnimation.tsx` | Reduzir baseSize, remover frontSizeMul, cores por silhueta lateral |

