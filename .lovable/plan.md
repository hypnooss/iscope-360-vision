

## Landing Page Premium -- Rede Animada estilo Maze

### Análise da Referência

A Maze usa uma esfera de partículas animadas no hero -- milhares de pontos teal/cyan formando uma estrutura esférica 3D com linhas conectoras, rotação lenta e efeito glow. O texto fica centralizado por cima. O fundo é dark navy (#0b1220).

### Abordagem

Criar uma rede de infraestrutura animada usando **Canvas 2D** nativo (sem Three.js -- evita dependência pesada e funciona bem para este efeito). A rede terá:

- ~150 nós (pontos) distribuídos em padrão circular/esférico
- Linhas conectoras entre nós próximos com opacidade baseada na distância
- Movimento orbital lento (rotação suave)
- Glow teal nos pontos e linhas
- Efeito de profundidade (pontos mais distantes = menores e mais transparentes)

O grid quadriculado existente fica sobreposto com fade via CSS mask.

### Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `src/components/NetworkAnimation.tsx` | **Novo** -- Componente Canvas 2D com rede animada de partículas |
| `src/pages/Index.tsx` | Substituir `AnimatedBackground` por `NetworkAnimation`. Manter seções full-page. Remover orbes CSS. |
| `src/index.css` | Pequenos ajustes no grid overlay |

### NetworkAnimation.tsx -- Detalhes

Componente fullscreen com `<canvas>` posicionado `fixed inset-0 z-0`.

**Algoritmo:**
1. Gerar ~120 pontos em distribuição esférica (coordenadas 3D projetadas em 2D)
2. Cada ponto orbita lentamente com velocidades angulares ligeiramente diferentes
3. Projeção perspectiva simples: `screenX = centerX + x * scale / z`, tamanho do ponto proporcional a `1/z`
4. Conectar pontos com distância < threshold com linhas semi-transparentes
5. Cor: `rgba(20, 184, 166, opacity)` -- teal da paleta
6. Glow via `ctx.shadowBlur` e `ctx.shadowColor`
7. Grid quadriculado sobreposto via div CSS existente com `grid-radial-mask`

**Performance:** requestAnimationFrame, ~120 pontos, throttle em mobile. Canvas resize via ResizeObserver.

### Index.tsx -- Mudanças

- Importar `NetworkAnimation` e renderizar como background fixo
- Manter `animated-grid-dots` + `grid-radial-mask` sobreposto ao canvas
- Todas as seções mantêm `min-h-screen flex items-center justify-center`
- Hero: H1 72px/800, sem badge, sem imagens
- Demais seções inalteradas em conteúdo

### Estrutura Final

```text
┌─────────────────────────────────┐
│  Canvas (fixed, z-0)            │  ← rede animada fullscreen
│  Grid overlay (fixed, z-0)      │  ← grid com mask radial
├─────────────────────────────────┤
│  Header (sticky, z-50)          │
├─────────────────────────────────┤
│  Hero (min-h-screen, z-10)      │  ← texto sobre a rede
├─────────────────────────────────┤
│  Credibility (min-h-screen)     │
├─────────────────────────────────┤
│  Features (min-h-screen)        │
├─────────────────────────────────┤
│  How it Works (min-h-screen)    │
├─────────────────────────────────┤
│  Security (min-h-screen)        │
├─────────────────────────────────┤
│  CTA (min-h-screen)             │
├─────────────────────────────────┤
│  Footer                         │
└─────────────────────────────────┘
```

A rede animada fica visível principalmente no hero (onde não há bg-card/20) e se torna sutil nas demais seções através dos backgrounds semi-opacos de cada seção.

