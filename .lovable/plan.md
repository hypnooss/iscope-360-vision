

## Corrigir comandos PowerShell do Blueprint M365 e adicionar steps faltantes

### Problemas identificados

1. **`exo_mailbox_statistics`**: O cmdlet `Get-EXOMailboxStatistics` nao aceita o parametro `-ResultSize`. Precisa usar pipeline com `Get-EXOMailbox` primeiro.
2. **`exo_message_trace`**: `Get-MessageTrace` sera depreciado em setembro 2025. Substituir por `Get-MessageTraceV2`.
3. **`exo_shared_mailboxes`**: O analyzer espera dados desse step (para "Shared Mailboxes sem Owner") mas ele NAO existe no blueprint.
4. **`exo_connectors`**: O analyzer espera dados com key `exo_connectors`, mas o blueprint tem `exo_inbound_connectors` e `exo_outbound_connectors` separados. Falta um fallback no analyzer ou um step consolidado.

### Mudancas

#### 1. Migration SQL - Corrigir comandos e adicionar steps faltantes

**Corrigir `exo_mailbox_statistics`:**
```
Get-EXOMailbox -ResultSize 500 | Get-EXOMailboxStatistics | Select-Object DisplayName, ItemCount, TotalItemSize, LastLogonTime, MailboxTypeDetail | ConvertTo-Json -Depth 5
```

**Substituir `exo_message_trace` por `Get-MessageTraceV2`:**
```
Get-MessageTraceV2 -StartDate (Get-Date).AddHours(-24) -EndDate (Get-Date) | Select-Object Received, SenderAddress, RecipientAddress, Subject, Status, Size, MessageTraceId | ConvertTo-Json -Depth 5
```
Nota: `Get-MessageTraceV2` nao tem `-PageSize`, usa paginacao automatica.

**Adicionar step `exo_shared_mailboxes`:**
```
Get-Mailbox -RecipientTypeDetails SharedMailbox -ResultSize 500 | Select-Object DisplayName, PrimarySmtpAddress, RecipientTypeDetails, GrantSendOnBehalfTo | ConvertTo-Json -Depth 5
```

#### 2. Edge Function `m365-analyzer/index.ts` - Fallback para connectors

Adicionar fallback no analyzer para combinar `exo_inbound_connectors` + `exo_outbound_connectors` quando `exo_connectors` estiver vazio:

```typescript
if (exoConnectors.length === 0) {
  exoConnectors = [...get('exo_inbound_connectors'), ...get('exo_outbound_connectors')];
}
```

### Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| Migration SQL (novo) | Atualizar blueprint `e276576e-...`: corrigir `exo_mailbox_statistics`, substituir `exo_message_trace` por V2, adicionar `exo_shared_mailboxes` |
| `m365-analyzer/index.ts` (~linha 1786) | Adicionar fallback para `exoConnectors` usando steps inbound/outbound existentes |

### Resultado esperado

- Exchange Health passara a coletar shared mailboxes e connectors corretamente
- Mailbox statistics coletara sem erro de parametro
- Message trace usara o cmdlet atual (V2) sem warning de depreciacao
- Dashboard exibira dados nas secoes "Exchange Health" e "Auditoria"

