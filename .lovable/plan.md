

## Corrigir barras do Risk Chart

O problema é duplo:

1. **Cores com opacidade muito baixa** — As barras "Total" usam `${row.color}33` (20% opacidade) e `${row.color}11` (7% opacidade), praticamente invisíveis no fundo escuro.
2. **`style-origin="left"` inválido** — Isso não é uma prop válida do React/framer-motion. O `scaleX` anima a partir do centro por padrão, o que faz a barra não preencher corretamente. Precisa ser `style={{ transformOrigin: 'left' }}`.

### Mudanças em `src/components/landing/SteppedShowcase.tsx`

**Barra "Total" (linha 162-172):**
- Mudar gradiente de `${row.color}33, ${row.color}11` para `${row.color}88, ${row.color}44` (opacidade ~53% a ~27%)
- Remover prop inválido `style-origin="left"`
- Mesclar `transformOrigin: 'left'` no `style`

**Barra "Exploitable" (linha 174-183):**
- Adicionar `transformOrigin: 'left'` no `style`

