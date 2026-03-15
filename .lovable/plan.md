

## Filtrar Shared Mailboxes da Cobertura MFA no Entra ID Analyzer

### Problema
Contas de shared mailbox aparecem na lista de "MFA Desativado" inflando o número de usuários sem MFA. Essas contas não possuem senha e não podem ter MFA, gerando falso-positivo.

### Abordagem

**Backend (`entra-id-dashboard` edge function):**
- Adicionar uma chamada Graph API para listar shared mailboxes: `GET /users?$filter=assignedPlans/any(x:x/servicePlanId eq '...') and accountEnabled eq true&$select=userPrincipalName` — ou, mais simples e direto, usar o endpoint Exchange: `GET /reports/getMailboxUsageDetail(period='D7')` que inclui o campo `recipientType`.
- Alternativa mais leve: consultar `GET /users?$select=userPrincipalName,assignedLicenses&$filter=userType eq 'member'` e cruzar com os UPNs — shared mailboxes tipicamente **não possuem licenças atribuídas**.
- A abordagem **mais confiável**: usar o EXO Management API para listar recipients com `RecipientTypeDetails eq 'SharedMailbox'`. Porém, requer permissões Exchange.
- **Melhor opção prática**: usar `GET /mailboxes` ou a flag `mailboxSettings` — mas a forma mais garantida é listar shared mailboxes via Graph: `GET https://graph.microsoft.com/v1.0/users?$filter=mailboxSettings/userPurpose eq 'shared'` (requer beta) ou simplesmente buscar os dados que já temos do PowerShell Agent na tabela de snapshots do analyzer.

**Decisão recomendada**: Cruzar os UPNs do MFA com a lista de shared mailboxes do snapshot do Exchange Analyzer (já coletado pelo agent em `exoSharedMailboxes`), evitando chamadas extras à Graph API.

| Arquivo | Alteração |
|---|---|
| `supabase/functions/entra-id-dashboard/index.ts` | Buscar último snapshot do Exchange analyzer para obter lista de shared mailbox UPNs; marcar `isSharedMailbox: true` nos `userDetails` do MFA |
| `src/hooks/useEntraIdDashboard.ts` | Adicionar `isSharedMailbox?: boolean` ao tipo `MfaUserDetail` dentro da interface |
| `src/components/m365/entra-id/MfaCoverageSheet.tsx` (ou equivalente) | Adicionar toggle "Excluir caixas compartilhadas" nas abas; recalcular contadores dinamicamente |
| `src/components/m365/entra-id/MfaUserList.tsx` | Exibir badge "Shared" ao lado de usuários de caixa compartilhada |
| Card de Cobertura MFA no dashboard | Exibir contagem com e sem shared mailboxes (ex: "45 sem MFA (12 shared)") |

### Fluxo
1. Edge function busca snapshot Exchange → extrai UPNs de shared mailboxes
2. Ao montar `userDetails` do MFA, marca `isSharedMailbox` por cruzamento de UPN
3. Frontend exibe toggle para filtrar e badge visual para identificar

