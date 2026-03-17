

## Problemas identificados

Comparando print 2 (antes) com o estado atual, há **3 problemas distintos**:

### 1. Elementos removidos/adicionados indevidamente no Hero
O hero **perdeu**:
- Badge "PLATAFORMA DE SEGURANÇA & COMPLIANCE" acima do título
- Botões CTA "Acessar Plataforma" e "Ver como funciona"

E **ganhou** algo que não deveria estar lá:
- Barra de logos (Alloy, Cohere, Forge, Lattice, Axiom) — linhas 118-126 do Index.tsx

### 2. Cor do subtítulo alterada
A classe do parágrafo está `text-muted-foreground/70` (linha 110), que fica muito escuro. No print 2 (antes), o texto era branco/claro — deveria ser `text-foreground/80` ou similar.

### 3. Globo ainda quase invisível
O globo aparece mas extremamente fraco. O `coreFade = mix(0.15, 1.0, ...)` combinado com `aAlpha` base de 0.25-0.75 e additive blending com 22k partículas deveria ser visível, mas o core suppression ainda é muito agressivo. O principal problema é que as partículas do "corpo" da esfera têm alpha efetivo muito baixo (~0.04-0.11).

## Plano de correção

### `src/pages/Index.tsx`
- **Restaurar** o badge "PLATAFORMA DE SEGURANÇA & COMPLIANCE" acima do h1
- **Restaurar** os botões CTA "Acessar Plataforma" e "Ver como funciona" abaixo do subtítulo
- **Remover** a barra de client logos (linhas 117-126)
- **Corrigir** a cor do subtítulo de `text-muted-foreground/70` para `text-foreground/80`

### `src/components/NetworkAnimation.tsx`
- Aumentar alpha base das partículas: `0.25 + random * 0.5` → `0.4 + random * 0.5`
- Aumentar `coreFade` mínimo: `mix(0.15, 1.0, ...)` → `mix(0.35, 1.0, ...)`
- Reduzir a potência do rim: `pow(vRim, 0.4)` → `pow(vRim, 0.3)` para distribuir mais opacidade pelo corpo

Resultado: globo com corpo visível + hero restaurado ao estado correto do print 2.

