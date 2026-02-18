
# Migração para Leaflet: Mapa de Ataques com Tiles Reais

## Por que o PNG estático nunca vai funcionar corretamente

O problema não é calibração — é arquitetura. Uma imagem PNG fixa tem dois problemas intransponíveis:

1. **Nenhuma projeção é perfeita para uma imagem arbitrária**: não há como saber exatamente onde os pixels da imagem correspondem a lat/lng sem metadados geográficos (GeoTIFF, etc.)
2. **A projeção matemática e o pixel visual nunca coincidem 100%**: qualquer fórmula `project()` é uma aproximação que vai errar em algumas regiões

O Zabbix (e qualquer ferramenta profissional) usa **tile servers** exatamente por isso: o engine converte lat/lng para pixel com precisão matemática absoluta, sem aproximações.

## Solução: react-leaflet + CartoDB Dark Matter

**Leaflet** é a biblioteca de mapas mais usada do mundo (GitHub stars: ~41k). Com `react-leaflet` (wrapper React oficial) e tiles do **CartoDB Dark Matter** (gratuito, sem API key, visual escuro idêntico ao atual), o mapa ficará:

- Visualmente idêntico ao atual (fundo escuro com continentes cinza)
- Geograficamente preciso por definição — lat/lng é convertido pelo engine do Leaflet
- Sem dependência de API key ou serviço externo pago

**Provider de tiles**: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Gratuito para uso razoável
- Visual dark idêntico ao mapa atual
- Atribuição: CartoDB / OpenStreetMap

## Animações: como manter os projéteis?

Como Leaflet renderiza o mapa em canvas/HTML mas os overlays em SVG separado, vamos usar **Leaflet SVG Overlay** para manter as animações de projéteis exatamente como estão. A estratégia:

```
┌─────────────────────────────────────────────────────────────┐
│ Leaflet Map Container (div, posicionado absolutamente)       │
│  ├─ TileLayer (CartoDB Dark Matter tiles)                   │
│  ├─ CircleMarker por país (com raio proporcional ao count)  │
│  ├─ Polyline (trail line do país → firewall)                │
│  └─ SVGOverlay (animações de projéteis CSS/SVG)             │
│       ├─ <animateMotion> dos círculos voadores              │
│       └─ impact flash no ponto do firewall                  │
└─────────────────────────────────────────────────────────────┘
```

Para o modo **inline** (preview no dashboard, 200px de altura), o mapa será desabilitado para zoom/pan e mostrará uma visão estática da área. Para o modo **fullscreen**, zoom e pan ficam habilitados.

## Arquivos modificados

| Arquivo | Operação |
|---|---|
| `package.json` | Adicionar `leaflet`, `react-leaflet`, `@types/leaflet` |
| `src/components/firewall/AttackMap.tsx` | Reescrever usando react-leaflet |
| `src/index.css` | Importar `leaflet/dist/leaflet.css` |

O `AttackMapFullscreen.tsx` **não precisa ser modificado** pois apenas passa props para `AttackMap`.

## Detalhes técnicos da implementação

### Instalação de dependências
```
leaflet ^1.9.4
react-leaflet ^4.2.1
@types/leaflet ^1.9.x
```

### Estrutura do novo AttackMap

```tsx
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Tiles escuros gratuitos (sem API key)
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export function AttackMap({ deniedCountries, ... }) {
  const points = useMemo(() => { /* mesmo cálculo de antes, mas usando lat/lng direto */ }, [...]);

  return (
    <MapContainer
      center={[20, 10]}
      zoom={2}
      zoomControl={false}
      dragging={!fullscreen ? false : true}
      scrollWheelZoom={false}
      style={{ height: fullscreen ? '100%' : '200px', width: '100%', background: '#0f1117' }}
    >
      <TileLayer url={TILE_URL} attribution="CartoDB/OSM" />

      {/* Círculos por país com tooltip */}
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={p.r}
          pathOptions={{ color: p.color, fillColor: p.color, fillOpacity: 0.7 }}
        >
          <Tooltip>{p.label}: {p.count} eventos</Tooltip>
        </CircleMarker>
      ))}

      {/* Linhas de trajeto */}
      {firewallLocation && points.map((p, i) => (
        <Polyline
          key={`line-${i}`}
          positions={[[p.lat, p.lng], [firewallLocation.lat, firewallLocation.lng]]}
          pathOptions={{ color: p.color, weight: 0.8, opacity: 0.2 }}
        />
      ))}

      {/* Marcador do firewall */}
      {firewallLocation && (
        <CircleMarker
          center={[firewallLocation.lat, firewallLocation.lng]}
          radius={10}
          pathOptions={{ color: '#06b6d4', fillColor: '#06b6d4', fillOpacity: 0.8 }}
        >
          <Tooltip permanent>Firewall</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
```

### Animações de projéteis

Para manter as animações de projéteis, usaremos um `SVGOverlay` do Leaflet que sincroniza as coordenadas com o sistema de projeção do mapa. O hook `useMap()` do react-leaflet fornece `map.latLngToLayerPoint()` para converter lat/lng em pixels SVG em tempo real. Isso garante que os projéteis sigam os trilhos corretos mesmo com zoom/pan.

### CSS necessário

No `src/index.css`, adicionar:
```css
@import 'leaflet/dist/leaflet.css';

/* Remover controles do Leaflet que não usamos */
.leaflet-control-attribution { display: none !important; }
```

## Resultado esperado

| Aspecto | Antes (PNG) | Depois (Leaflet) |
|---|---|---|
| Precisão geográfica | ~±500km de erro | Precisão de metros |
| EUA (Kansas) | Na fronteira Canada | Centro-norte dos EUA ✓ |
| Brasil (Tocantins) | Bahia | Estado do Tocantins ✓ |
| Marrocos | Sobre Itália | Noroeste da África ✓ |
| Zoom/pan | Não suportado | Suportado no fullscreen |
| Tiles | PNG estático local | Tiles online atualizados |
| API key | Não necessário | Não necessário (CartoDB grátis) |

## Riscos e mitigações

- **Leaflet carrega tiles da internet**: o mapa requer conectividade. Em redes sem acesso externo, os tiles não carregarão (mas as marcas e animações continuarão funcionando sobre fundo escuro).
- **CSS do Leaflet**: precisa ser importado globalmente para não quebrar o layout dos controles internos.
- **SSR**: não aplicável (projeto Vite/React SPA puro).
