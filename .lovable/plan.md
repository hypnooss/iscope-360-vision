

## Corrigir Dados Zerados no M365 Analyzer Dashboard

### Diagnóstico

O tenant MOVECTA tem licença P2 e a Graph API funciona parcialmente (Conditional Access retornou 3 insights). Os zeros nos demais modulos tem 3 causas raiz:

### Causa 1: Filtro de data malformado (signInLogs e auditLogs zerados)

O `periodFilter` usa formato Postgres (`2026-02-28 14:41:58.405+00`) em vez de ISO 8601 (`2026-02-28T14:41:58.405Z`), causando erro 400 no Graph API. Alem disso, o periodo e de apenas ~27 minutos (gap entre snapshots), quando deveria ser 24h.

**Arquivo**: `supabase/functions/m365-analyzer/index.ts`
- Converter `period_start` para ISO 8601 com `.toISOString()`
- Usar janela de 24h fixa em vez do `period_start` do snapshot
- Isso corrige: Security Risk (signInLogs), Identity Access (auditLogs), Audit Compliance (auditLogs)

### Causa 2: Permissao `IdentityRiskyUser.Read.All` ausente

Essa permissao nao esta no fluxo OAuth nem na validacao. O endpoint `/identityProtection/riskyUsers` retorna 403.

**Arquivos**:
- `supabase/functions/m365-oauth-callback/index.ts` — adicionar `IdentityRiskyUser.Read.All` na lista de scopes
- `supabase/functions/validate-m365-connection/index.ts` — adicionar validacao dessa permissao
- `supabase/functions/validate-m365-permissions/index.ts` — adicionar teste
- `src/lib/m365PermissionDescriptions.ts` — adicionar descricao

**Acao do usuario**: Apos deploy, sera necessario reconectar o tenant no Azure para conceder a nova permissao.

### Causa 3: Endpoint deprecado de MFA Registration

O m365-analyzer usa `reports/credentialUserRegistrationDetails` (deprecado), enquanto todas as outras funcoes ja usam `reports/authenticationMethods/userRegistrationDetails`.

**Arquivo**: `supabase/functions/m365-analyzer/index.ts`
- Substituir as 2 ocorrencias do endpoint deprecado pelo correto

### Causa 4: Steps do Agent falhando ou ausentes

Os steps `exo_mailbox_statistics` e `exo_message_trace` estao falhando no Agent. Os steps `exo_shared_mailboxes`, `exo_connectors`, `exo_transport_rules` nao existem no blueprint.

**Acao**: Isso requer alteracao no blueprint do Agent (fora do escopo desta correcao de frontend/edge function). Os dados de Exchange Health e Exfiltracao dependem desses steps.

### Resumo de Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `m365-analyzer/index.ts` | Corrigir periodFilter (ISO 8601 + 24h), corrigir endpoint credentialRegistration, adicionar logging de erros |
| `m365-oauth-callback/index.ts` | Adicionar `IdentityRiskyUser.Read.All` nos scopes |
| `validate-m365-connection/index.ts` | Adicionar validacao da nova permissao |
| `validate-m365-permissions/index.ts` | Adicionar teste da nova permissao |
| `m365PermissionDescriptions.ts` | Adicionar descricao da nova permissao |

### Resultado Esperado

Apos deploy + reconexao do tenant:
- **Security Risk**: signInLogs populados (MFA failures, blocked accounts, impossible travel)
- **Identity Access**: auditLogs populados (new users, disabled users, service accounts)
- **Audit Compliance**: auditLogs populados (admin changes, delegations)
- **Risky Users**: dados do Identity Protection disponiveis
- **MFA Status**: endpoint correto retornando registros de MFA

