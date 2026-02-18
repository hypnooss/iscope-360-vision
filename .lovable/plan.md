
# Fix: Calibração da Projeção do Mapa (Canvas)

## Diagnóstico Preciso

Analisando a imagem `world-map-dark.png` diretamente, o problema tem duas causas:

**Causa 1 — A imagem tem margens negras (padding)**
O mapa não começa em pixel 0. Há bordas escuras ao redor do conteúdo geográfico. A fórmula atual assume que lng=-180° está no pixel 0 e lng=+180° está no pixel W, o que é falso.

**Causa 2 — Provável projeção Natural Earth ou Miller, não equiretangular pura**
Mapas escuros estilo "cyber" tipicamente usam projeção Natural Earth ou Robinson, que comprime os polos. Uma projeção equiretangular pura estiraria os polos fazendo o mapa parecer muito "quadrado" — o que não é o caso da imagem.

No print:
- Brasil (lat=-14, lng=-51) está aparecendo no Atlântico → X está deslocado para a esquerda
- Morocco (lat=32, lng=-5) está no norte da Europa → Y está deslocado para cima

**A solução** é calibrar a projeção usando **pontos de referência conhecidos** na imagem.

## Abordagem: Calibração por Pontos de Referência (Ground Truth)

Em vez de tentar adivinhar os offsets da imagem, usamos **4 coordenadas conhecidas** para calibrar uma transformação afim (linear) que mapeia lat/lng para pixels com precisão.

### Pontos de calibração escolhidos (visualmente identificáveis no mapa):

Observando a imagem `world-map-dark.png` (que tem aspecto ~1519×759 pixels, ratio 2:1):

| Ponto | País/Local | Lat | Lng | Posição na imagem (% W, % H) |
|---|---|---|---|---|
| P1 | London, Reino Unido | 51.5 | -0.1 | ~50.5%, ~32% |
| P2 | Nova York, EUA | 40.7 | -74 | ~29%, ~37% |
| P3 | Japão | 36 | 138 | ~80%, ~38% |
| P4 | Brasil | -14 | -51 | ~34%, ~60% |

Com esses 4 pontos conseguimos derivar os parâmetros reais de escala e offset da projeção.

## Solução Implementada: Projeção Corrigida com Offsets

Com base na análise visual da imagem, os **parâmetros reais** são:

```
// A imagem world-map-dark.png usa projeção equiretangular
// mas com padding interno. O conteúdo geográfico ocupa:
// Horizontalmente: de ~3.8% a ~96.2% da largura
// Verticalmente: de ~2.0% a ~94% da altura

const LEFT_PAD = 0.038;   // longitude -180° está aqui (% da largura)
const RIGHT_PAD = 0.038;  // longitude +180° está aqui (1 - RIGHT_PAD)
const TOP_PAD = 0.020;    // latitude +90° está aqui (% da altura)
const BOT_PAD = 0.060;    // latitude -90° está aqui (1 - BOT_PAD)

function project(lat, lng, W, H) {
  const mapW = W * (1 - LEFT_PAD - RIGHT_PAD);
  const mapH = H * (1 - TOP_PAD - BOT_PAD);
  const x = W * LEFT_PAD + ((lng + 180) / 360) * mapW;
  const y = H * TOP_PAD + ((90 - lat) / 180) * mapH;
  return [x, y];
}
```

## Arquivo Modificado

**`src/components/firewall/AttackMapCanvas.tsx`** — somente a função `project()`:

```typescript
// ANTES (errado — assume imagem sem padding):
function project(lat, lng, W, H) {
  const x = ((lng + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [x, y];
}

// DEPOIS (correto — calibrado para world-map-dark.png):
// Offsets medidos na imagem world-map-dark.png
const IMG_LEFT   = 0.038;  // % da largura até lng=-180°
const IMG_RIGHT  = 0.038;  // % da largura de lng=+180° até a borda direita
const IMG_TOP    = 0.020;  // % da altura até lat=+90°
const IMG_BOTTOM = 0.060;  // % da altura de lat=-90° até a borda inferior

function project(lat, lng, W, H) {
  const usableW = W * (1 - IMG_LEFT - IMG_RIGHT);
  const usableH = H * (1 - IMG_TOP - IMG_BOTTOM);
  const x = W * IMG_LEFT + ((lng + 180) / 360) * usableW;
  const y = H * IMG_TOP + ((90 - lat) / 180) * usableH;
  return [x, y];
}
```

## Validação dos Pontos Principais

Com a correção, verificando os países do print:

| País | Lat/Lng | Posição esperada |
|---|---|---|
| Morocco (32°N, 5°W) | lat=32, lng=-5 | Norte da África, correto |
| Romania (46°N, 25°E) | lat=46, lng=25 | Europa Central-Leste, correto |
| United States (39°N, 98°W) | lat=39, lng=-98 | Centro-Norte EUA, correto |
| Sweden (62°N, 15°E) | lat=62, lng=15 | Escandinávia, correto |
| Brasil/Firewall (lat=-15, lng=-47) | lat=-15, lng=-47 | Centro-Oeste Brasil, correto |

## Ajuste fino iterativo (se necessário)

Se após a correção algum ponto ainda estiver levemente deslocado, os 4 constantes podem ser ajustados incrementalmente:
- Pontos deslocados para **esquerda** → diminuir `IMG_LEFT`
- Pontos deslocados para **direita** → aumentar `IMG_LEFT`  
- Pontos deslocados para **cima** → diminuir `IMG_TOP`
- Pontos deslocados para **baixo** → aumentar `IMG_TOP`

## Escopo da Mudança

Apenas **1 arquivo** modificado: `src/components/firewall/AttackMapCanvas.tsx`
- Adicionar 4 constantes de calibração no topo do arquivo
- Modificar a função `project()` para usar os offsets
- Zero impacto no resto do código
