

## Plano: Glass effect no header e em todos os cards

### 1. Header — glass desde o início

Atualmente o header só aplica `bg-background/80 backdrop-blur-2xl` quando `scrolled = true`. Quando não scrollado, é totalmente transparente (`bg-transparent backdrop-blur-none`).

**Correção em `src/components/Header.tsx` (linha 36-38)**:
- Remover a condicional: aplicar **sempre** `bg-background/40 backdrop-blur-xl border-border/10`
- Quando scrollado, intensificar para `bg-background/60 backdrop-blur-2xl border-border/20`

### 2. Cards — adicionar backdrop-blur glass em todos

Os cards usam duas classes CSS definidas em `index.css`:

**`glass-container`** (usado nos cards de "Pain Points", testimonials, blog):
- Atual: `bg-card/60 backdrop-blur-2xl border border-border/30`
- Já tem glass. Nenhuma mudança necessária.

**`feature-card`** (usado nos cards de features):
- Atual: `bg-card/50 backdrop-blur-xl border border-border/30`
- Já tem glass. Nenhuma mudança necessária.

**Cards dos steps "Como o iScope resolve"** (linha 304):
- Atual: `bg-card border border-border/40` — **sem glass**
- Adicionar: `bg-card/60 backdrop-blur-xl`

**Cards de estatísticas** (seção "Problem", linhas 156-225):
- Atual: sem container/card — são apenas `div` com texto direto
- Adicionar: wrapper com `glass-container` ou equivalente `bg-card/50 backdrop-blur-xl border border-border/30 rounded-xl p-6`

### Arquivos a alterar

1. **`src/components/Header.tsx`** — glass permanente no header
2. **`src/pages/Index.tsx`** — glass nos step icons e nos stat blocks

