

## Desativar steps de análise per-mailbox

O blueprint **"M365 - Exchange Online"** (`e276576e-0de0-4463-a0ee-940b970c4f69`) tem 5 steps que iteram caixa por caixa e causaram os 3 timeouts consecutivos:

| Step | Categoria | Padrão | Timeout |
|------|-----------|--------|---------|
| `exo_inbox_rules` | Exchange - Mailbox | `Get-Mailbox -ResultSize 200 \| ForEach-Object { Get-InboxRule }` | 300s |
| `exo_mailbox_audit` | Exchange - Audit | `Get-EXOMailbox -ResultSize 100` | 120s |
| `exo_mailbox_forwarding` | Exchange - Mailbox | `Get-Mailbox -ResultSize 500 \| Where-Object` | 120s |
| `exo_mailbox_quota` | Exchange - Mailbox | `Get-Mailbox -ResultSize 500` | 180s (optional) |
| `exo_mailbox_statistics` | Exchange - Mailbox | `Get-EXOMailbox -ResultSize 500 \| Get-EXOMailboxStatistics` | 180s (optional) |

### Plano

Atualizar o `collection_steps` do blueprint via SQL, adicionando `"enabled": false` a cada um desses 5 steps. Isso mantém os steps documentados no blueprint (podem ser reativados depois) sem removê-los.

Os 18 steps restantes (organizacionais: anti-phish, DKIM, connectors, transport rules, safe links, etc.) continuam ativos normalmente.

### Detalhes técnicos

Execução de um UPDATE SQL no campo JSONB `collection_steps` do blueprint, iterando os steps e adicionando a flag `enabled: false` nos 5 IDs listados acima. O código do Agente Python já precisa respeitar essa flag — caso contrário, será necessário um ajuste no `tasks.py` para filtrar steps com `enabled: false`.

