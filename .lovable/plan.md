

## Ajustes de layout em duas seções

### 1. Seção "O Problema Real" (`src/pages/Index.tsx`, linhas 225-237)

- **Remover a badge** "O PROBLEMA REAL" (linhas 225-229): deletar o `div` com o ícone `AlertTriangle` e o texto.
- **Subir o conteúdo**: reduzir o `mb-6` do wrapper `text-center` e o `mt-16` dos cards para diminuir o espaço vertical. Não mexer no ScrollDownIndicator.

### 2. Seção Showcase - Timeline (`src/components/landing/SteppedShowcase.tsx`)

- **Diminuir espaço entre timeline e conteúdo**: na `ProgressBar` (linha 244), reduzir `pt-20 pb-8` para algo como `pt-14 pb-4`.
- **Mover tudo para baixo**: no container de conteúdo (linha 381, `flex-1 flex items-center`), trocar `items-center` por `items-end` ou adicionar `pt-8`/`mt-4` para empurrar o conteúdo para baixo dentro do sticky container. Não mexer no ScrollDownIndicator.

### Arquivos editados
- `src/pages/Index.tsx` — remover badge, ajustar espaçamento
- `src/components/landing/SteppedShowcase.tsx` — reduzir padding da timeline, deslocar conteúdo para baixo

