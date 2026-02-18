
# Zoom 2.5 no Mapa de Ataques

## Problema

O Leaflet por padrão usa `zoomSnap: 1`, o que faz o zoom "encaixar" apenas em números inteiros. Se você definir `zoom={2.5}` sem alterar o `zoomSnap`, o mapa vai arredondar para 2 ou 3 automaticamente.

## Solução

Adicionar `zoomSnap={0.5}` ao `<MapContainer>` — isso permite zoom fracionado em incrementos de 0.5 — e setar os valores de zoom para `2.5`.

## Mudanças em `src/components/firewall/AttackMap.tsx`

| Onde | Mudança |
|---|---|
| `<MapContainer zoom={3}>` | `zoom={2.5}` |
| `<MapContainer>` | Adicionar `zoomSnap={0.5}` |
| `FitWorldBounds` → `setView([20, 0], 3)` | `setView([20, 0], 2.5)` |
| `MapResizer` → `setView([20, 0], 3)` | `setView([20, 0], 2.5)` |
