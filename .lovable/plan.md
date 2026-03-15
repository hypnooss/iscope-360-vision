

## Melhorias na Esfera + Transições de Scroll

### Problemas Identificados

Comparando com a Maze (prints):

1. **Esfera pequena**: `sphereRadius = min(w,h) * 0.44` — Maze preenche ~70-80% do viewport. Precisa `* 0.55` ou mais.
2. **Face frontal apagada**: A fórmula `depthAlpha = normalizedZ²` faz partículas da frente ficarem com alpha ~0.85 max, mas o brightness boost é baixo. Na Maze as partículas frontais são MUITO brilhantes (quase brancas) enquanto as traseiras são sutis.
3. **Sem magenta/purple**: Maze tem ~15% de partículas magenta/pink claramente visíveis. Nosso "purple" (139,92,246) é muito discreto e raro (8%).
4. **Sem transição no scroll**: Na Maze, ao rolar a esfera se achata em faixa horizontal, depois vira nuvem dispersa. Efeito crucial que falta.

### Mudanças

#### `src/components/NetworkAnimation.tsx` — Reescrita

**Tamanho:**
- `sphereRadius = Math.min(w, h) * 0.55` (de 0.44)
- Centro em `cy = h * 0.48` para ficar mais centrado no hero

**Cores — paleta expandida com magenta:**
- 45% dark teal (15, 140, 130)
- 25% bright teal (20, 184, 166) 
- 15% cyan (30, 200, 220)
- **10% magenta/pink (180, 60, 180)** — novo, como na Maze
- 5% bright white-cyan (120, 230, 240)

**Profundidade — front mais brilhante:**
- Front alpha: até 1.0 (de 0.85)
- Back alpha: mínimo 0.03 (muito dim)
- Front particles: size multiplicador 1.5x extra
- Glow em top 35% de Z (de 20%)

**Transição de scroll — morphing:**
- Ler `window.scrollY` no loop de animação
- Calcular `scrollProgress = scrollY / windowHeight` (0 a ~3+)
- **Phase 0 (hero)**: Esfera normal
- **Phase 1 (0.3-1.0)**: Esfera se achata — `phi` é interpolado para comprimir no eixo Y, criando um elipsóide/faixa
- **Phase 2 (1.0-2.0)**: Partículas se dispersam — `radiusMul` aumenta, esfera "explode" em nuvem, desloca para cima
- **Phase 3 (2.0+)**: Nuvem de fundo sutil, partículas espalhadas como background

Implementação: No draw loop, aplicar `morphFactor` ao phi de cada partícula:
```
// Achatar: comprimir phi em torno de PI/2
const flattenedPhi = lerp(p.phi, Math.PI/2, flattenAmount)
// Dispersar: expandir raio
const morphedRadius = r * (1 + disperseAmount * 2)
```

O canvas continua `fixed inset-0` então acompanha o scroll naturalmente.

**Performance**: 6000 partículas se mantém. O scroll read é via `scrollY` direto (não event listener separado, lido dentro do rAF).

#### `src/pages/Index.tsx` — Sem mudanças estruturais
Apenas ajuste menor: as seções com `bg-card/20` bloqueiam a visão do canvas. Trocar para `bg-background/60` para que as partículas dispersas sejam visíveis como background sutil nas seções inferiores.

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/components/NetworkAnimation.tsx` | Esfera maior, cores com magenta, front brilhante, morphing no scroll |
| `src/pages/Index.tsx` | bg-card/20 → bg-background/60 nas seções |

