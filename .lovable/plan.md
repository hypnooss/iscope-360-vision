

## Plano: Listar agents "sem módulo" nos cards de Status

### Problema

Os cards de Status (Supervisors e Monitors) mostram a contagem de agents "sem Supervisor" e "sem Monitor", mas não listam **quais** são esses agents — diferente do comportamento dos desatualizados, que são listados individualmente.

### Solução

1. **Armazenar a lista de agents sem módulo** (não apenas a contagem) nos states `supervisorStats` e `monitorStats`.
2. **Renderizar a lista** dentro do bloco `extra` passado ao `renderStatusSection`, no mesmo estilo visual da lista de desatualizados (com scroll area e badges).

### Implementação em `UpdateManagementCard.tsx`

| Mudança | Detalhe |
|---------|---------|
| Expandir interfaces de stats | Adicionar `withoutSupervisorList` e `withoutMonitorList` (arrays com `name` e `client`) |
| `loadStats()` | Coletar os agents sem supervisor/monitor em arrays nomeados |
| Bloco `extra` do Supervisor (linhas 468-476) | Adicionar lista expansível dos agents sem Supervisor abaixo do card de contagem |
| Bloco `extra` do Monitor (linhas 495-503) | Adicionar lista expansível dos agents sem Monitor abaixo do card de contagem |

A lista usará o mesmo padrão visual dos desatualizados: `ScrollArea` com bullet points, nome do agent e nome do cliente.

