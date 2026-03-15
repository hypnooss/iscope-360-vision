

## Corrigir: Shared Mailboxes não são marcadas nos dados de MFA

### Causa Raiz

O `entra-id-dashboard` tenta buscar shared mailboxes em `m365_analyzer_snapshots.metrics.exoSharedMailboxes`, mas esse campo **nunca é salvo** no snapshot. O `m365-analyzer` coleta `exoSharedMailboxes` corretamente, mas ao montar o objeto `allMetrics`, apenas salva `exchangeHealth.sharedMailboxesNoOwner` (um número), descartando a lista de UPNs.

### Solução

| Arquivo | Alteração |
|---|---|
| `supabase/functions/m365-analyzer/index.ts` | Adicionar campo `exoSharedMailboxes` ao objeto `allMetrics`, contendo a lista de UPNs das shared mailboxes coletadas |

Na linha ~2695 (antes de `dataSource`), adicionar:

```typescript
// Shared mailbox UPNs for cross-referencing by entra-id-dashboard
exoSharedMailboxes: exoSharedMailboxes.map((m: any) => ({
  UserPrincipalName: m.UserPrincipalName || m.PrimarySmtpAddress || '',
  DisplayName: m.DisplayName || '',
})),
```

Isso é tudo. O código do `entra-id-dashboard` (linhas 336-393) já está pronto para ler esse campo e marcar `isSharedMailbox: true` nos userDetails do MFA. Após o deploy, basta executar uma nova tarefa de M365 Analyzer para que o snapshot inclua os UPNs e o dashboard passe a funcionar corretamente.

