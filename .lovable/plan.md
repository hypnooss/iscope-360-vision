
# Plano: Corrigir Formato do Blueprint M365

## Problema Identificado

O blueprint "M365 - Exchange & SharePoint (Agent)" foi criado com o formato de `commands` incorreto:

```text
ATUAL (errado):
┌──────────────────────────────────────────────────────────────┐
│  step.params = {                                             │
│    "module": "ExchangeOnline",                               │
│    "commands": ["Get-Mailbox... | ConvertTo-Json"]  ← STRING │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘

ESPERADO pelo PowerShellExecutor:
┌──────────────────────────────────────────────────────────────┐
│  step.params = {                                             │
│    "module": "ExchangeOnline",                               │
│    "commands": [                                             │
│      {"name": "exo_mailbox_forwarding",             ← OBJETO │
│       "command": "Get-Mailbox..."}                           │
│    ]                                                         │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
```

O executor PowerShell (linha 181-183 em powershell.py) chama:
```python
cmd_name = cmd.get("name", cmd.get("command", "unknown"))
cmd_text = cmd.get("command", "")
```

Isso falha quando `cmd` é uma string em vez de um dicionário.

## Solução

Recriar o blueprint com o formato correto de `commands`.

## Alteração

### Migração SQL

Atualizar o blueprint `e276576e-0de0-4463-a0ee-940b970c4f69` com a estrutura correta:

```json
{
  "steps": [
    {
      "id": "exo_mailbox_forwarding",
      "type": "powershell",
      "category": "Exchange - Mailbox",
      "params": {
        "module": "ExchangeOnline",
        "commands": [
          {
            "name": "exo_mailbox_forwarding",
            "command": "Get-Mailbox -ResultSize Unlimited | Where-Object { $_.ForwardingAddress -or $_.ForwardingSmtpAddress } | Select-Object DisplayName, PrimarySmtpAddress, ForwardingAddress, ForwardingSmtpAddress, DeliverToMailboxAndForward"
          }
        ]
      }
    },
    ...mais 15 steps com o mesmo padrão...
  ]
}
```

Observações importantes:
1. Remover `| ConvertTo-Json` dos commands - o executor já faz isso automaticamente
2. Cada step tem apenas UM command (assim o resultado fica no step_id correto)
3. O `name` do command deve corresponder ao `id` do step

## Fluxo Corrigido

1. Agent recebe task com steps corretamente formatados
2. PowerShell executor processa `commands[0].get("name")` e `commands[0].get("command")`
3. Script PowerShell é construído e executado
4. Resultados são enviados via `agent-step-result`

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | UPDATE do blueprint com estrutura correta de commands |
