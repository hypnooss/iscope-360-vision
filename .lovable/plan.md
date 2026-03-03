

## Plano: Nova regra de compliance EXO-023 — Regras de Inbox com Erros

### Contexto
O Exchange Online marca regras de inbox corrompidas com a propriedade `InError = True` e exibe o aviso "The Inbox rule contains errors". O comando atual `exo_inbox_rules` no blueprint não coleta esse campo.

### Alterações

**1. Atualizar o blueprint M365 (device_blueprints)** — Modificar o step `exo_inbox_rules` para incluir o campo `InError` no `Select-Object`:

```powershell
Get-Mailbox -ResultSize 200 | ForEach-Object { 
  $mbx = $_.PrimarySmtpAddress; 
  Get-InboxRule -Mailbox $mbx -ErrorAction SilentlyContinue | 
  Select-Object @{N='MailboxOwner';E={$mbx}}, Name, Enabled, ForwardTo, ForwardAsAttachmentTo, RedirectTo, DeleteMessage, MoveToFolder, InError 
} | Where-Object { $_ -ne $null } | ConvertTo-Json -Depth 5
```

**2. Criar regra de compliance EXO-023** — INSERT na tabela `compliance_rules`:
- Código: `EXO-023`
- Nome: `Regras de Inbox com Erros`
- Categoria: `email_exchange`
- Severidade: `medium`
- `evaluation_logic`: `{ "source_key": "exo_inbox_rules", "evaluate": { "type": "check_inbox_rules_in_error" } }`
- Descrições de pass/fail, recommendation, technical_risk, business_impact

**3. Adicionar evaluator `check_inbox_rules_in_error`** em duas edge functions:
- **`supabase/functions/agent-task-result/index.ts`**: Novo case no bloco de custom evaluators + função `evaluateInboxRulesInError` que filtra itens com `InError === true`
- **`supabase/functions/m365-security-posture/index.ts`**: Novo case no switch de evaluators com a mesma lógica

A lógica: filtra o array `exo_inbox_rules` por `InError === true`, lista as mailboxes afetadas com nome da regra, retorna `fail` se houver ≥1, `pass` caso contrário.

### Arquivos a editar
1. `supabase/functions/agent-task-result/index.ts` — Adicionar case + função evaluator
2. `supabase/functions/m365-security-posture/index.ts` — Adicionar case no switch
3. Migration SQL — UPDATE do blueprint (campo `InError` no Select-Object) + INSERT da regra EXO-023

