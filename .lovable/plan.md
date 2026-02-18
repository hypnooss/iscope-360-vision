
# Solução Definitiva: Canvas HTML5 (como Kaspersky/Fortinet)

## O que os mapas profissionais fazem

Após pesquisa nos mapas de referência (Kaspersky CyberMap, Fortinet Threat Map, SonicWall), a técnica é sempre a mesma: **Canvas HTML5 com requestAnimationFrame**. Não Leaflet, não SVG overlay, não tiles externos.

Por que Canvas resolve o problema das bordas:

- Um `<canvas>` com `width = container.offsetWidth` e `height = container.offsetHeight` preenche EXATAMENTE o espaço do container — geometricamente impossível ter bordas
- O mapa mundial é desenhado via `ctx.drawImage()` escalado para 100% da largura/altura
- Coordenadas lat/lng são projetadas para pixels com uma fórmula equiretangular simples aplicada sobre as dimensões reais do canvas
- Animações de projéteis são feitas com `requestAnimationFrame` — fluidas e sem dependência de nenhuma biblioteca

## Por que as abordagens anteriores falharam

| Tentativa | Por que falhou |
|---|---|
| Leaflet + noWrap | Tiles rasterizados não existem fora da projeção Mercator em zoom 2 |
| Leaflet + fitBounds | O zoom calculado ainda deixa espaço em widescreen 16:9/21:9 |
| Leaflet + background color | Camufla, não resolve — o tile ainda não existe |
| SVG + world-map-dark.png | Imagem PNG não se alinha com coordenadas projetadas com precisão |

A causa raiz é geométrica: em zoom 2 com projeção Mercator, a largura do mapa é 2^zoom × 256 = 1024px. Em uma tela de 1920px, sobram 448px de borda. Isso NÃO é configurável.

## Solução: AttackMapCanvas.tsx

Criar um componente React com Canvas puro, usado EXCLUSIVAMENTE no fullscreen. O Leaflet continua intacto no modo inline do dashboard.

### Como funciona

**1. Canvas preenche o container:**
```
canvas.width  = container.offsetWidth   // ex: 1920px
canvas.height = container.offsetHeight  // ex: 1080px
ctx.drawImage(worldMapImg, 0, 0, canvas.width, canvas.height)
```

**2. Projeção equiretangular (mesma fórmula usada pelos mapas profissionais):**
```
x = (lng + 180) / 360 * canvas.width
y = (90 - lat) / 180 * canvas.height
```

Esta fórmula é aplicada diretamente sobre as dimensões do canvas, então os pontos se alinham perfeitamente com a imagem em qualquer resolução.

**3. Animações com requestAnimationFrame:**
Cada projétil tem um `progress` (0 a 1) que avança a cada frame. A posição é interpolada entre origem e destino com `lerp`. Ao chegar, reseta. Múltiplos projéteis por rota com delay staggered (igual ao atual).

**4. Glow via Canvas shadowBlur:**
```
ctx.shadowColor = '#ef4444'
ctx.shadowBlur = 12
ctx.fillStyle = '#ef4444'
ctx.arc(x, y, r, 0, Math.PI * 2)
```

**5. ResizeObserver** atualiza canvas.width/height automaticamente ao redimensionar a janela.

### Estrutura do componente

```
AttackMapCanvas.tsx
  - useRef: canvasRef, animRef, imgRef
  - useEffect[mount]: carrega world-map-dark.png, inicia loop de animação
  - useEffect[resize]: ResizeObserver → redimensiona canvas e reprojecta
  - draw(): ctx.clearRect → drawImage → trails → projectiles → markers → firewall
  - Projéteis: array de { progress, delay, routeIndex } atualizado por frame
```

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/firewall/AttackMapCanvas.tsx` | CRIAR — Canvas fullscreen, sem dependência externa |
| `src/components/firewall/AttackMapFullscreen.tsx` | MODIFICAR — usar `AttackMapCanvas` no lugar de `AttackMap fullscreen` |
| `src/components/firewall/AttackMap.tsx` | SEM ALTERAÇÃO — Leaflet continua no modo inline/dashboard |

## Detalhes Visuais Mantidos

Todos os elementos visuais existentes são mantidos:
- Marcadores de países com raio proporcional à contagem e glow colorido
- Linhas de trail tracejadas com baixa opacidade
- Projéteis animados staggered (3 por rota, delays 0s / 0.7s / 1.4s)
- Flash de impacto pulsante no ponto do firewall
- Marcador ciano do firewall com label

## Por que Canvas garante zero bordas

O canvas literalmente tem `width = tela` e `height = tela`. A imagem é desenhada com `drawImage(img, 0, 0, width, height)` — como `object-fit: cover` mas sem o problema de aspect ratio, porque o mapa mundo equiretangular foi projetado exatamente para ser esticado nessa proporção.

Não há tiles, não há zoom, não há projeção Mercator, não há borda possível.
