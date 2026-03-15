

## Redesign Completo da Landing -- Estilo Maze

### Análise: O que a Maze faz vs. o que temos

**Maze:** Um globo denso feito de ~2000+ partículas minúsculas (sem linhas de conexão visíveis entre elas). É uma nuvem de pontos formando uma esfera, com variação de tamanho e opacidade por profundidade. O texto fica sobreposto no centro. Ao rolar, há seções narrativas com estatísticas de impacto, fluxo de solução em 4 passos, showcases de features com scroll-pinning, testimonials, e CTA final com o globo repetido.

**Nosso atual:** 120 nós com linhas de conexão = parece um grafo/malha hexagonal, não um globo denso de partículas. Seções genéricas com cards básicos.

### Mudanças

#### 1. NetworkAnimation.tsx -- Reescrever completamente

O problema principal: poucos pontos (120) + linhas de conexão = aspecto de diagrama, não de globo.

Nova abordagem:
- **2500 partículas** distribuídas na superfície de uma esfera (Fibonacci sphere, sem variação de raio -- todos na superfície)
- **SEM linhas de conexão** -- apenas pontos, como a Maze
- Tamanho dos pontos: 0.5-2px, proporcional à profundidade (mais perto = maior)
- Opacidade: baseada em Z (frente = brilhante, trás = quase invisível)
- Rotação lenta e contínua no eixo Y
- Leve oscilação no eixo X para dar vida
- Raio da esfera: ~min(viewportWidth, viewportHeight) * 0.35 -- responsivo
- Cor: `rgba(20, 184, 166, alpha)` -- teal puro
- Glow sutil apenas nos pontos da frente (top 20% de Z) via radial gradient pequeno
- Canvas fullscreen, fixed, z-0

#### 2. Index.tsx -- Reestruturar toda a página

Nova estrutura narrativa inspirada na Maze:

```text
┌─────────────────────────────────┐
│  Header (sticky, minimal)       │
├─────────────────────────────────┤
│  HERO (100vh)                   │
│  - Globo de partículas atrás    │
│  - H1 centralizado              │
│  - Subheadline + 2 botões       │
│  - Logos de credibilidade       │
│  - "Scroll down" indicator      │
├─────────────────────────────────┤
│  PROBLEMA (100vh)               │
│  - "Backlogs de vulnerabilidade │
│    continuam crescendo"         │
│  - 3 métricas de impacto        │
│    (estilo Maze: número grande  │
│     + contexto)                 │
├─────────────────────────────────┤
│  SOLUÇÃO - FLUXO (100vh)        │
│  - H2: "Como o iScope resolve"  │
│  - 4 passos numerados           │
│    01 → 02 → 03 → 04           │
│  - Linha horizontal conectando  │
├─────────────────────────────────┤
│  FEATURES - 3 showcases         │
│  - Cada um com H2 + descrição   │
│  - Cards com glass effect       │
│  - Scroll reveal staggered      │
├─────────────────────────────────┤
│  TESTIMONIALS                   │
│  - 2-3 quotes com nome/cargo    │
│  - Glass cards                  │
├─────────────────────────────────┤
│  CTA FINAL (100vh)              │
│  - Globo repetido (menor)       │
│  - H2 + botões                  │
├─────────────────────────────────┤
│  Footer                        │
└─────────────────────────────────┘
```

**Seção PROBLEMA** (nova): Narrativa de impacto com números grandes animados. Estilo: "40,000 vulnerabilidades publicadas em 2024", "34% aumento em exploits", etc. Adaptado para infraestrutura/compliance.

**Seção SOLUÇÃO**: Fluxo em 4 passos (01-04) com linha horizontal conectora, igual à Maze. Cada passo com ícone + texto curto.

**Scroll indicator**: Seta ou texto "SCROLL DOWN" no bottom do hero, como a Maze.

**Testimonials**: 2-3 citações fictícias de CISOs/CTOs em glass cards.

#### 3. Header.tsx -- Simplificar mais

Remover ícone LogIn do botão CTA. Manter apenas texto "Acessar Plataforma" ou mudar para "Book Demo" style como Maze. Background mais transparente.

#### 4. index.css -- Ajustes menores

Manter grid overlay com mask. Remover orb-drift keyframes (não mais usados). Adicionar classe `.scroll-indicator` com animação bounce sutil.

### Arquivos alterados

| Arquivo | O que muda |
|---|---|
| `src/components/NetworkAnimation.tsx` | Reescrita total: 2500 partículas, sem linhas, globo denso |
| `src/pages/Index.tsx` | Reestruturação completa: nova narrativa, seção problema, fluxo 4 passos, testimonials |
| `src/components/Header.tsx` | Simplificar botão CTA |
| `src/index.css` | Remover orb-drift, adicionar scroll-indicator animation |

