

## Melhorias na Esfera + Ajustes de UI

### Problemas identificados

1. **Esfera pouco densa**: 2500 partículas com tamanho pequeno (0.4-1.8px) — parece esparsa. Maze usa ~5000+ partículas densas.
2. **Cor monótona**: Apenas teal. Maze usa teal + cyan + purple/magenta para variação.
3. **Grid quadriculado**: `animated-grid-dots grid-radial-mask` sobreposto — remover.
4. **Botão "Acessar Plataforma"**: Precisa ser removido do hero.
5. **Botão "Ver como funciona"**: Precisa ser maior.

### Mudanças

#### `src/components/NetworkAnimation.tsx`
- Aumentar `PARTICLE_COUNT` para **4000**
- Aumentar `sphereRadius` para `Math.min(w, h) * 0.42`
- Adicionar **variação de cor**: cada partícula tem uma cor interpolada entre teal (`20,184,166`), cyan (`6,182,212`), e purple/magenta (`139,92,246`) baseada na posição angular (basePhi). ~70% teal, ~20% cyan, ~10% purple.
- Aumentar tamanho dos pontos frontais para `max(0.5, 2.2 * scale)`
- Aumentar alpha máximo para `0.95` nos pontos frontais
- Glow mais agressivo nos pontos da frente (top 30% depth)

#### `src/pages/Index.tsx`
- **Remover** a div `animated-grid-dots grid-radial-mask` (linha 74)
- **Remover** o botão "Acessar Plataforma" (linhas 104-110)
- **Aumentar** o botão "Ver como funciona": `h-14 px-14 text-lg`

#### `src/index.css`
- Nenhuma mudança necessária (classes do grid permanecem mas não serão usadas)

