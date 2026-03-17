

## Aumentar espaçamento da timeline expandida

### Problema
A timeline expandida está visualmente "espremida" — pouco padding interno e pouco espaço entre a timeline e a próxima linha da tabela.

### Mudança

No componente `ScheduleTimeline` (linha 820 de `SchedulesPage.tsx`), aumentar o padding do container:

- Mudar `px-6 py-4` para `px-6 py-6` (mais respiro vertical)
- Aumentar `mb-3` do header para `mb-4`
- Adicionar `mt-1` nos dots da timeline para mais espaço entre header e dots

Na `TableCell` que envolve o timeline (linhas 730 e 1287), adicionar padding bottom:
- Mudar `className="p-0 border-b border-border/50"` para `className="p-0 pb-2 border-b border-border/50"`

Isso dará mais respiro visual acima, abaixo e entre os elementos internos da timeline.

