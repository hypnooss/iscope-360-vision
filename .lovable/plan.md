
# Voltar ao Leaflet no Fullscreen — com Mapa Melhor e Sem Bordas Brancas

## Diagnóstico: Por que as bordas aparecem no Leaflet

O problema das bordas brancas no Leaflet em modo fullscreen é causado por uma limitação matemática da projeção Mercator: em `zoom=2`, o tile world tem `2^2 × 256 = 1024px` de largura. Em telas widescreen (1920px, 2560px), o mapa simplesmente não tem tiles suficientes para cobrir toda a largura — o Leaflet preenche o espaço com a cor de fundo.

**A solução definitiva:** definir o `background` do `MapContainer` com a **mesma cor do tile do mapa**. Para o CartoDB Dark Matter, é `#0e0e10`. Para o Stadia Alidade Smooth Dark, é `#121726`. Assim, o espaço "vazio" é invisível — parece que o mapa se estende infinitamente.

Além disso, usaremos `noWrap={true}` no `TileLayer` para impedir repetição lateral do mapa.

## Novo Tile: Stadia Maps — Alidade Smooth Dark

O **Stadia Alidade Smooth Dark** é visualmente superior ao CartoDB Dark Matter:
- Cores mais profundas e contrastantes
- Fronteiras de países com linhas finas mais elegantes
- Oceanos em `#121726` (quase preto-azulado) — cor de fundo perfeita para disfarçar as bordas
- Uso gratuito sem API key para projetos razoáveis

URL do tile:
```
https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png
```

## Mudanças por Arquivo

### 1. `src/components/firewall/AttackMap.tsx` (modo inline — dashboard)

- Trocar `TILE_URL` de CartoDB para Stadia Alidade Smooth Dark
- Adicionar `noWrap={true}` no `<TileLayer>`
- Ajustar o `background` do `mapStyle` para `#121726` (cor dos oceanos do novo tile)

### 2. `src/components/firewall/AttackMapFullscreen.tsx`

- Substituir `<AttackMapCanvas>` de volta para `<AttackMap fullscreen={true}>`
- Ajustar o `background` do container de `#0a0e1a` para `#121726`
- O `<AttackMap>` já tem toda a lógica de projéteis SVG, marcadores, trails e firewall marker

### 3. `src/components/firewall/AttackMapCanvas.tsx`

- Manter o arquivo (não deletar), mas ele fica sem uso por ora

## Por que isso resolve o problema das bordas

```text
┌─────────────────────────────────────────────────────┐
│                   Tela 1920px                       │
│  ┌──────────────────────────────────────────────┐   │
│  │         Tiles Leaflet (1024px)               │   │
│  │        [mapa propriamente dito]              │   │
│  └──────────────────────────────────────────────┘   │
│  [espaço vazio]                     [espaço vazio]  │
└─────────────────────────────────────────────────────┘

SEM FIX: espaço vazio aparece branco/cinza
COM FIX: espaço vazio tem background: '#121726'
         = mesma cor dos oceanos do tile = invisível
```

## Configurações do MapContainer no fullscreen

```typescript
<MapContainer
  center={[20, 0]}
  zoom={2}
  minZoom={1}
  maxZoom={8}
  worldCopyJump={false}
  noWrap={true}          // sem repetição lateral
  zoomControl={true}     // permitir zoom no fullscreen
  dragging={true}
  scrollWheelZoom={true}
  doubleClickZoom={true}
  attributionControl={false}
  style={{ height: '100%', width: '100%', background: '#121726' }}
>
  <TileLayer
    url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
    noWrap={true}
    attribution="..."
  />
```

## Resumo dos Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/firewall/AttackMap.tsx` | Trocar tile URL + `noWrap` + ajustar cor de fundo |
| `src/components/firewall/AttackMapFullscreen.tsx` | Voltar a usar `<AttackMap fullscreen>` em vez de Canvas |

Resultado: coordenadas **sempre** corretas (Leaflet projeta lat/lng nativamente), mapa mais bonito, bordas invisíveis, sem Canvas, sem calibração manual.
