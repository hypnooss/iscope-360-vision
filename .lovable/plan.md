

## Landing Page Premium Rebuild -- iScope 360

Analisei as referências visuais (Linear, Vercel, Snyk) e o estado atual da landing page. O design atual tem boa estrutura mas precisa de refinamentos significativos para atingir o nivel dessas referências. Os principais gaps:

1. **Hero centralizado** (como Linear/Snyk) em vez de split layout -- mais impactante
2. **Tipografia maior e mais bold** -- H1 a 72px com peso 800
3. **Background mais sofisticado** -- grid com dots nos cruzamentos simulando rede
4. **Header com 72px de altura** e nav centralizado
5. **Cards com mais profundidade** e animações refinadas
6. **Métricas/números** para dar credibilidade (como Datadog)
7. **Espaçamento mais generoso** entre seções

### Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `index.html` | Adicionar Manrope como opção de font |
| `src/index.css` | Refinar animated-grid com dots, melhorar glass effects, adicionar hero-glow radial |
| `src/components/Header.tsx` | Header 72px, nav centralizado, botão com glow hover, logo left / nav center / CTA right |
| `src/pages/Index.tsx` | Reescrever hero centralizado, tipografia 72px/800, badges de métricas, seção de números, cards refinados, CTA mais forte |
| `tailwind.config.ts` | Adicionar keyframe `dot-pulse` para network dots |

### Design Decisions

**Hero**: Centralizado com headline 72px peso 800, badge acima do título ("Plataforma de Infraestrutura"), subheadline 18px, dois botões centralizados. Abaixo, dashboard preview com glass container e glow. Similar a Linear/Snyk.

**Header**: Layout tripartite -- logo esquerda, nav center (`Produto | Segurança | Como Funciona | Login`), botão CTA direita com glow no hover. Altura 72px. Glass blur background.

**Background**: Grid animado com linhas 1px `rgba(20,184,166,0.08)` + dots nos cruzamentos das linhas usando `radial-gradient`. Orbe de glow centralizado no hero. Segundo orbe menor na seção CTA.

**Features**: 3 cards com ícone em circle com bg-primary/10, título 20px bold, descrição 16px. Hover com `translateY(-4px)`, border glow, shadow expansion.

**Como Funciona**: Steps com números grandes (48px, primary), linha conectora gradient entre steps no desktop. Cada step com ícone + título + descrição.

**Métricas de credibilidade** (nova seção após credibility logos): 3 números em row -- "50+ Verificações", "360° Visibilidade", "Zero Intervenção Manual". Estilo minimal como em Datadog.

**CTA**: Gradiente animado mais pronunciado, headline 36px/700, botão 56px de altura com padding largo e glow pulse.

**Responsividade**: Hero empilha verticalmente no mobile com texto centralizado. Cards `grid-cols-1` no mobile. Steps empilham no mobile sem connector line.

### Detalhes CSS Novos

```css
/* Grid com dots nos cruzamentos */
.animated-grid-dots {
  background-image: 
    linear-gradient(rgba(20,184,166,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(20,184,166,0.06) 1px, transparent 1px),
    radial-gradient(circle, rgba(20,184,166,0.15) 1px, transparent 1px);
  background-size: 60px 60px, 60px 60px, 60px 60px;
  background-position: -1px -1px, -1px -1px, 29px 29px;
}

/* Hero glow orb */
.hero-glow {
  background: radial-gradient(ellipse 600px 400px at 50% 30%, 
    rgba(20,184,166,0.12), transparent);
}
```

### Estrutura Final da Página

1. Header fixo 72px (glass blur)
2. Hero centralizado (badge + H1 72px + sub + 2 botões + dashboard mockup)
3. Credibilidade (logos placeholder)
4. Métricas (3 números impactantes)
5. Features (3 cards)
6. Como Funciona (3 steps com connector)
7. Preview da Plataforma (glass container)
8. Segurança e Confiança (grid 2x2)
9. CTA Final (gradiente animado)
10. Footer

