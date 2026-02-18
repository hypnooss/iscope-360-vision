
# Aumentar o Zoom Padrão do Mapa de Ataques

## O Que Mudar

O zoom atual é `2` (visão bem aberta do mundo inteiro). Mudar para `3` vai aproximar o mapa mantendo todos os continentes visíveis, mas com mais detalhe.

## Arquivos e Linhas

**`src/components/firewall/AttackMap.tsx`** — 3 ocorrências do valor `2`:

| Onde | Linha | Mudança |
|---|---|---|
| `<MapContainer zoom={2}>` | 176 | `zoom={3}` |
| `FitWorldBounds` → `map.setView([20, 0], 2)` | 108 | `map.setView([20, 0], 3)` |
| `MapResizer` → `map.setView([20, 0], 2)` | 119 | `map.setView([20, 0], 3)` |

O `minZoom` permanece em `1` (usuário pode afastar no fullscreen) e o `maxZoom` permanece em `4` (inline) / `8` (fullscreen) — sem alteração.
