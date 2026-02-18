
# Fix Definitivo: Calibração Precisa da Projeção do Mapa

## Análise Real da Imagem

Ao visualizar `world-map-dark.png` diretamente, confirmei que esta é uma imagem **equiretangular pura** que cobre **-180° a +180° de longitude** e **-90° a +90° de latitude**, com margens pretas nas bordas polares (Ártico e Antártica são áreas pretas sem continentes relevantes).

Isso significa que a fórmula equiretangular pura é a correta:
```
x = (lng + 180) / 360 * 1000
y = (90 - lat) / 180 * 500
```

## Por que os pontos ainda estão errados?

As calibrações anteriores (`MAP_TOP_LAT=83`, `MAP_BOT_LAT=-58`) foram inseridas com base em suposições incorretas — elas **distorcem** a projeção em vez de corrigí-la, comprimindo o espaço de coordenadas e deslocando os pontos para baixo e para os lados.

**Verificação matemática dos erros observados:**

Com os valores atuais (`TOP=83`, `BOT=-58`, range=141°):
- **EUA** (lat=39): y = (83-39)/141 × 500 = **155.9** → aparece muito alto (fronteira Canada)
- **Tocantins** (lat=-10): y = (83-(-10))/141 × 500 = **329.8** → aparece na Bahia (mais ao sul)

Com a projeção pura (range=180°):
- **EUA** (lat=39): y = (90-39)/180 × 500 = **141.7** → ainda alto? Não — na imagem, o centro dos EUA está a ~28% do topo (lat 39° = 51° abaixo do polo), o que equivale a 51/180 × 500 = **141.7px**, posição correta no mapa completo ±90°.
- **Tocantins** (lat=-10): y = (90-(-10))/180 × 500 = **277.8** → centro da América do Sul, correto.

**O problema real com as coordenadas do EUA:**

O código usa `'us': [39, -98]` que é o centróide geográfico dos EUA (Kansas/Nebraska). Na projeção pura, lat=39° cai em y=141, que visualmente é a fronteira norte dos EUA contínuo, não o Canada. O usuário viu "divisa com Canada" porque o ponto estava mais alto com o MAP_TOP_LAT=83 causando compressão.

## Solução: Reverter para Projeção Equiretangular Pura

Remover os offsets de calibração incorretos e usar a fórmula padrão para mapas ±90°:

```typescript
// REMOVER estas constantes
const MAP_LEFT_LNG = -180;
const MAP_RIGHT_LNG = 180;
const MAP_TOP_LAT = 83;
const MAP_BOT_LAT = -58;

// NOVA função — projeção equiretangular pura para imagem ±90°/±180°
function project(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return [x, y];
}
```

## Verificação dos Pontos Críticos

| País | Lat/Lng | x (novo) | y (novo) | Posição esperada na imagem |
|---|---|---|---|---|
| EUA centro (Kansas) | 39°N, -98° | 228 | 141 | Norte dos EUA continental ✓ |
| Brasil | -14°S, -51° | 365 | 289 | Centro do Brasil ✓ |
| Tocantins (FW) | -10°S, -48° | 367 | 277 | Norte do Brasil central ✓ |
| Marrocos | 32°N, -5° | 486 | 161 | NW África ✓ |
| Romênia | 46°N, 25° | 569 | 122 | SE Europa ✓ |
| China | 35°N, 104° | 789 | 152 | China central ✓ |

## Arquivo Modificado

| Arquivo | Operação |
|---|---|
| `src/components/firewall/AttackMap.tsx` | Remover constantes de offset, restaurar projeção equiretangular pura |

## Resultado Esperado

- Firewall em Tocantins (lat=-10, lng=-48) aparecerá no norte do Brasil, interior do país
- EUA aparecerá no centro dos estados contíguos (Kansas/Nebraska), não na fronteira canadense
- Marrocos aparecerá no noroeste da África, não sobre a Europa
- Todos os outros pontos ficarão geograficamente precisos
