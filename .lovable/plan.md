

## Plano: Réplica exata dos shaders e pipeline do MazeHQ

Agora temos os shaders originais. As diferenças do nosso código atual são significativas.

### Diferenças encontradas

1. **Fragment shader**: O MazeHQ usa `texture2D(pointTexture, gl_PointCoord)` — uma textura de sprite, não falloff matemático. Vamos gerar uma textura radial programaticamente (canvas 64x64 com gradiente circular) que replica o efeito.

2. **O "outro efeito" (print 1) é o modo Stream/Funnel** — não é um "sand/flat" separado. É controlado pelo uniform `uStream` que ativa um fluxo horizontal de partículas com afunilamento (`uFunnelStart`, `uFunnelEnd`, `uFunnelThick`, `uFunnelNarrow`, etc). Nosso morph/flat sand inteiro está errado e será removido.

3. **Particle count**: MazeHQ usa **16384** partículas em esfera unitária, escalada por `scaleFactor = 0.75` via `points.scale.setScalar()`.

4. **Camera**: FOV **45**, posição z=**400**.

5. **Atributos extras**: `aSelection`, `aStreamFreq`, `aFunnelNarrow`, `aFunnelThickness`, `aFunnelStartShift`, `aFunnelEndShift` — todos necessários para o shader compilar.

### Mudanças em `src/components/NetworkAnimation.tsx`

1. **Substituir vertex shader** pelo código exato colado pelo usuário
2. **Substituir fragment shader** pelo código exato (com `pointTexture`)
3. **Gerar `pointTexture`** via canvas: círculo branco com gradiente radial (centro opaco → borda transparente), carregado como `THREE.CanvasTexture`
4. **Remover** toda lógica de morph/flat/sand (atributo `aFlatPosition`, uniform `uMorph`, posições flat)
5. **Adicionar atributos** do stream: `aSelection`, `aStreamFreq`, `aFunnelNarrow`, `aFunnelThickness`, `aFunnelStartShift`, `aFunnelEndShift`
6. **Adicionar uniforms** do stream: `uStream`, `uSelection`, `uWidth`, `uHeight`, `uFunnelStart`, `uFunnelEnd`, `uFunnelThick`, `uFunnelNarrow`, `uFunnelStartShift`, `uFunnelEndShift`, `uFunnelDistortion`, `uIsMobile`
7. **Partículas**: 16384, esfera unitária (raio 1.0), `points.scale.setScalar(0.75 * scaleFactor)` onde scaleFactor depende do viewport
8. **Camera**: `PerspectiveCamera(45, aspect, 1, 2000)`, position z=400
9. **scrollProgress** agora controla `uStream` (0→1) em vez de morph, ativando o efeito de fluxo/funnel
10. **Uniforms exatos**: `uFrequency: 0.5`, `uAmplitude: 0.05`, `uDepth: 0.3`, `uSize: 10`, `uSpeed: 1.0`
11. **Cores**: `uRcolor:40, uGcolor:197, uBcolor:234` / `uRnoise:202, uGnoise:50, uBnoise:223`

### Mudanças em `src/pages/Index.tsx`

Nenhuma — a prop `scrollProgress` continua funcionando, só muda o que ela controla internamente.

