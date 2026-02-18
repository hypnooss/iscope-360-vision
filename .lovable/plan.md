
# Reverter Zoom para 3

## O que está errado

A imagem mostra o mapa em modo fullscreen com os tiles não renderizando — só fundo escuro com marcadores flutuando sem os contornos dos países. Isso é um problema de renderização que apareceu após a mudança para 2.5.

## Correção

Reverter as 3 ocorrências do valor `2.5` de volta para `3` em `src/components/firewall/AttackMap.tsx`:

| Onde | Mudança |
|---|---|
| `<MapContainer zoom={2.5}>` | `zoom={3}` |
| `FitWorldBounds` → `setView([20, 0], 2.5)` | `setView([20, 0], 3)` |
| `MapResizer` → `setView([20, 0], 2.5)` | `setView([20, 0], 3)` |

O `zoomSnap={0.5}` pode permanecer — não causa dano e permite que o usuário ajuste em incrementos de 0.5 manualmente no fullscreen.
