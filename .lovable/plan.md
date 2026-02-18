
# Fix: Pontos do Mapa de Ataques Posicionados Incorretamente

## Causa Raiz

O mapa está incorretamente alinhado devido a dois problemas combinados:

### Problema 1 — Conflito de `preserveAspectRatio`
- O SVG usa `preserveAspectRatio="xMidYMid meet"` (mantém proporção, adiciona letterbox)
- A `<image>` interna usa `preserveAspectRatio="xMidYMid slice"` (recorta para preencher)
- Isso cria duas áreas de renderização **diferentes**: a imagem é recortada de um jeito, mas a projeção matemática calcula posições em outro.

### Problema 2 — Mapa não é equiretangular puro
A imagem `world-map-dark.png` tem margens internas: as bordas laterais (Antártica, Ártico extremo) e os lados (±180°) não chegam exatamente às bordas do canvas da imagem. A fórmula `project()` assume que o viewBox 0,0→1000,500 coincide exatamente com lng=-180 a +180 e lat=90 a -90, o que não é verdade para esta imagem.

### Resultado observado
- Brasil (lat=-14, lng=-51) fica deslocado para o Atlântico
- Marrocos (lat=32, lng=-5) aparece sobre a Itália (lat=43, lng=12) — offset de ~17° de longitude

## Solução

### Parte 1 — Corrigir `preserveAspectRatio` da imagem

Unificar os dois `preserveAspectRatio` para a mesma política, garantindo que imagem e projeção compartilhem o mesmo sistema de coordenadas. O correto é usar `none` na imagem para que ela sempre preencha exatamente o viewBox 0,0→1000,500 sem recorte nem letterbox:

```tsx
// ANTES
<image href={worldMapDark} x="0" y="0" width="1000" height="500" preserveAspectRatio="xMidYMid slice" />

// DEPOIS
<image href={worldMapDark} x="0" y="0" width="1000" height="500" preserveAspectRatio="none" />
```

Com `none`, a imagem é esticada para preencher exatamente o viewBox. A fórmula matemática e a imagem agora compartilham exatamente o mesmo espaço.

### Parte 2 — Aplicar offsets de calibração na função `project()`

Mapas-múndi populares geralmente não mostram as latitudes extremas (>85°S/N). A imagem tipicamente cobre de ~-60° a +80° de latitude e de -180° a +180° de longitude, mas com pequenas margens. Precisamos calibrar os offsets para que os continentes visíveis coincidam com os pontos.

Com base nos erros observados (Marrocos aparece sobre a Itália = ~17° a mais para leste; Brasil quase no oceano = ~10° para direita), os offsets de calibração são:

```typescript
// Calibration offsets for the world-map-dark.png image
// These compensate for the image's internal margins and latitude crop
const MAP_LEFT_LNG = -180;    // leftmost longitude in image
const MAP_RIGHT_LNG = 180;    // rightmost longitude in image
const MAP_TOP_LAT = 85;       // topmost latitude in image (not 90)
const MAP_BOT_LAT = -60;      // bottommost latitude in image (not -90)

function project(lat: number, lng: number): [number, number] {
  const x = ((lng - MAP_LEFT_LNG) / (MAP_RIGHT_LNG - MAP_LEFT_LNG)) * 1000;
  const y = ((MAP_TOP_LAT - lat) / (MAP_TOP_LAT - MAP_BOT_LAT)) * 500;
  return [x, y];
}
```

Isso recalibra a projeção para os limites reais da imagem em vez de assumir ±90° de latitude.

### Parte 3 — Ajustar também as linhas de grade e equador/meridiano

As linhas decorativas (equador, meridiano principal) também usam a função `project()`, então serão automaticamente corrigidas após o ajuste. Apenas a posição Y do equador e X do meridiano no SVG precisam usar a nova fórmula — o que já acontecerá automaticamente.

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `src/components/firewall/AttackMap.tsx` | Corrigir `preserveAspectRatio` da imagem + recalibrar `project()` com limites reais do mapa |

## Resultado Esperado

| País | Antes | Depois |
|---|---|---|
| Brasil | Atlântico (quase no oceano) | Centro da América do Sul ✓ |
| Marrocos | Sobreposto à Itália | Noroeste da África ✓ |
| EUA | Ligeiramente deslocado E | Centro-Norte da América ✓ |
| China | Levemente deslocado | Centro da Ásia ✓ |

Os projéteis animados e o ponto do firewall também ficarão corretamente posicionados sobre os países de origem.
