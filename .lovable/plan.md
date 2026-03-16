

## Plano: Hero estilo MazeHQ — Globo como background centralizado

### Problema
O hero atual tem o globo isolado na coluna direita (grid 2 colunas). No MazeHQ, o globo é um elemento de fundo grande e centralizado, com o texto sobreposto no centro.

### Solução

Reestruturar o hero para o layout MazeHQ:

**`src/pages/Index.tsx` (hero section, linhas 87-152):**
- Remover o grid de duas colunas
- `NetworkAnimation` volta a ser um elemento de fundo absoluto cobrindo toda a seção hero (`absolute inset-0`)
- Texto centralizado sobre o globo (text-center, z-10)
- Manter headline, subheadline, CTAs e scroll indicator — apenas mudar o layout de side-by-side para centered/overlay
- Radial glow atrás do globo cobrindo a seção inteira

**`src/components/NetworkAnimation.tsx`:**
- Garantir que funciona bem como fundo full-section (já aceita `className`)

O resultado será visualmente próximo ao MazeHQ: globo grande como cenário, texto centralizado por cima.

