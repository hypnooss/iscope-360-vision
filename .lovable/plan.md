

## Plano: Scroll Down indicator em todas as seções

### O que será feito

Adicionar o indicador "Scroll down" (mesmo estilo do Hero — texto + linha animada) no final de **cada seção**, com um link clicável que faz smooth scroll para a próxima seção.

### Implementação

**1. Adicionar IDs faltantes nas seções** (`src/pages/Index.tsx`)

Algumas seções não têm `id`. Adicionar:
- "The Real Problem" → `id="real-problem"`
- Testimonials → `id="testimonials"`
- SteppedShowcase → precisa de um wrapper com `id="showcase"`

**2. Criar componente `ScrollDown`** (inline ou extraído)

Um componente reutilizável que recebe `targetId` e, ao clicar, faz `document.getElementById(targetId).scrollIntoView({ behavior: 'smooth' })`.

```text
<button onClick={scrollToTarget} className="flex flex-col items-center gap-2 cursor-pointer group">
  <span className="text-[10px] uppercase tracking-[0.32em] font-mono text-muted-foreground/50 
         group-hover:text-muted-foreground/80 transition-colors">Scroll down</span>
  <div className="relative w-px h-8 bg-muted-foreground/15 rounded-full overflow-hidden">
    <div className="...animate-scroll-dot..." />
  </div>
</button>
```

**3. Adicionar ScrollDown no final de cada seção**

| Seção | Target ID |
|-------|-----------|
| Hero | `problem` |
| Problem | `real-problem` |
| Real Problem | `how-it-works` |
| How it Works | `features` |
| Features | `showcase` |
| SteppedShowcase | `testimonials` |
| Testimonials | `blog` |
| Blog | `cta` |

O CTA final (última seção) **não** terá scroll down.

**4. Posicionamento**

Cada indicador será posicionado no centro horizontal, no final da seção (após todo o conteúdo), com `mt-16` para espaçamento.

### Arquivos alterados

- **`src/pages/Index.tsx`** — adicionar IDs, criar helper `ScrollDown`, inserir no final de cada seção

