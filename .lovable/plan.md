

## Aumentar espaçamento lateral global

Atualmente o `<main>` no AppLayout usa `px-2 lg:px-6` (~24px em desktop). Vou aumentar para `px-4 lg:px-12` (~48px em desktop), criando mais respiro lateral em todas as telas.

### Mudança
- **Arquivo**: `src/components/layout/AppLayout.tsx` (linha 853)
- **De**: `px-2 lg:px-6`
- **Para**: `px-4 lg:px-12`

