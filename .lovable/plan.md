

## Transição de Cor nas Partículas

### Problema
Atualmente cada partícula recebe uma cor fixa na criação (`colorR`, `colorG`, `colorB`) e nunca muda. No Maze, as cores das partículas **transicionam gradualmente** — a esfera tem regiões de teal que gradualmente viram magenta/purple, criando um gradiente vivo que se move com a rotação.

### Solução

Em vez de usar cores fixas por partícula, calcular a cor **dinamicamente no draw loop** baseada na posição angular (theta) da partícula **após a rotação**. Isso cria faixas/regiões de cor que parecem "pintadas" na esfera e se movem conforme ela gira.

#### `src/components/NetworkAnimation.tsx`

**Remover** `colorR`, `colorG`, `colorB` da interface `Particle` (ou ignorá-los). Adicionar um campo `colorSeed` (0-1) para leve variação individual.

**No draw loop**, após calcular a posição rotacionada (`rx`, `rz`), usar o ângulo horizontal da partícula no espaço de tela para interpolar entre cores:

```
// Ângulo horizontal após rotação
const angle = Math.atan2(rz, rx); // -PI a PI
const normalized = (angle + PI) / (2 * PI); // 0 a 1

// Gradiente: teal → cyan → magenta → teal
// Usar sin/cos para criar transição suave cíclica
const r = lerp(15, 180, magentaWeight) 
const g = lerp(184, 60, magentaWeight)
const b = lerp(166, 200, cyanWeight)
```

Três zonas de cor com transição suave (sin-based blending):
- **Teal** (20, 184, 166) — zona dominante (~50%)
- **Cyan** (30, 200, 230) — zona intermediária (~25%)  
- **Magenta** (170, 60, 180) — zona oposta (~25%)

O `colorSeed` por partícula adiciona ±15% de variação para evitar faixas uniformes demais.

**Resultado**: Conforme a esfera gira, as cores fluem naturalmente — exatamente como no Maze.

### Arquivo alterado
| Arquivo | Mudança |
|---|---|
| `src/components/NetworkAnimation.tsx` | Cor dinâmica por posição angular no draw loop |

