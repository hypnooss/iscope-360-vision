

## Corrigir ScrollArea e remover botão refresh redundante

### Problemas identificados

1. **ScrollArea não funciona com `max-h`** — O componente Radix ScrollArea precisa de altura fixa (`h-[200px]`) para ativar o overflow interno. `max-h` não funciona porque o Viewport do Radix não calcula o overflow corretamente.

2. **Botão refresh desnecessário** — Já existe um `setInterval` de 5s em linha 98-102 que chama `loadAgentStats()` automaticamente. O botão manual é redundante; vou removê-lo.

### Mudanças em `src/pages/admin/SettingsPage.tsx`

| Local | Mudança |
|-------|---------|
| Linha 833-835 | Remover o `<Button>` de refresh do "Status dos Agents" |
| Linha 861 | Trocar `max-h-[200px]` por `h-[200px]` no ScrollArea de agents |
| Linha 987 | Trocar `max-h-[200px]` por `h-[200px]` no ScrollArea de supervisors |
| Buscar botão refresh equivalente nos supervisors | Remover também, se existir |

O auto-refresh de 5s já garante que a lista se atualiza sozinha conforme os agents recebem updates.

