

## Landing Page Premium — iScope 360

### Visão Geral

Redesign completo da landing page (`src/pages/Index.tsx`) e do header (`src/components/Header.tsx`), mantendo a identidade visual existente (dark mode, teal primary `hsl(175 80% 45%)`, fontes Inter/JetBrains Mono). O resultado será uma página no nível visual de Stripe/Vercel/Linear.

### Fontes

Adicionar **Space Grotesk** (para headings) via Google Fonts no `index.html`. Body continua Inter.

### Arquivos Alterados

| Arquivo | O que muda |
|---|---|
| `index.html` | Adicionar Space Grotesk font import |
| `tailwind.config.ts` | Adicionar `font-heading: Space Grotesk`, novas keyframes (float, glow-pulse, grid-fade) |
| `src/index.css` | Adicionar estilos do grid animado, glow effects, glass containers |
| `src/components/Header.tsx` | Header completo com nav links (Produto, Segurança, Documentação, Login) + botão CTA, menu mobile hamburger |
| `src/pages/Index.tsx` | Reescrever com todas as 9 seções |

### Estrutura das Seções (Index.tsx)

**1. Background animado** — `<div>` absoluto com CSS grid animado (linhas teal sutis, pontos nos cruzamentos, animação lenta de opacidade)

**2. Header** — Já descrito acima. Sticky, blur, transparente.

**3. Hero** — Layout split: texto esquerda (H1 Space Grotesk 700, sub Inter 400, 2 botões) + direita mockup do dashboard (screenshot/placeholder com borda glass, floating animation, glow sutil)

**4. Credibilidade** — Texto "Construído para ambientes corporativos" + row de placeholders para logos (opacidade reduzida, grayscale)

**5. Features** — 3 cards glass com ícones (CheckCircle2, Shield, TrendingUp), hover com elevação e glow na borda

**6. Como Funciona** — 3 steps com números grandes, linha conectora entre eles, ícones contextuais

**7. Preview da Plataforma** — Container glass grande, placeholder para screenshot do dashboard, glow nas bordas

**8. Segurança e Confiança** — Grid 2x2 com ícones e textos curtos (análise automatizada, detecção de config inseguras, boas práticas, visibilidade)

**9. CTA Final** — Background com gradiente teal animado, H2 forte, botão grande

**10. Footer** — Links em row (Produto, Documentação, Segurança, Contato) + "© Precisio Analytics"

### Animações (CSS + Tailwind)

- **Grid de fundo**: linhas com `opacity` pulsando entre 0.02 e 0.06, animação 8s infinite
- **Fade-in on scroll**: Intersection Observer hook (`useScrollReveal`) para animar seções ao entrar no viewport
- **Float**: mockup do hero com `translateY` oscilando 10px, 6s infinite
- **Hover cards**: `scale(1.02)`, border-color transition para primary/30, box-shadow glow
- **CTA gradient**: background-position animado

### Responsividade

- Hero: `flex-col` no mobile, `lg:flex-row` desktop
- Features/Steps: `grid-cols-1 md:grid-cols-3`
- Max-width: `max-w-[1200px] mx-auto`
- Header: hamburger menu no mobile com sheet/drawer

### Componentes Auxiliares (inline no Index.tsx)

- `AnimatedGrid` — background SVG/CSS animado
- `SectionReveal` — wrapper com Intersection Observer fade-in
- `DashboardMockup` — placeholder glass container para preview

### Notas Técnicas

- Nenhuma dependência nova (tudo CSS + React)
- Logo existente `logo-iscope.png` reutilizado
- Navegação para `/auth` nos botões CTA
- Redirect para `/dashboard` se autenticado (lógica existente mantida)
- Space Grotesk apenas para H1/H2 da landing, sem impacto no restante do sistema

