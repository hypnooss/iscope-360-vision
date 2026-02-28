

## Correcao: Enriquecimento Graph API incompleto no M365 Analyzer

### Problema

Quando o agent envia dados do Exchange Online (PowerShell), o edge function `m365-analyzer` marca `hasAgentData = true` e pula o bloco principal de chamadas Graph API (linhas 1828-1875). Depois, o bloco de enriquecimento (linhas 1877-1904) so busca `riskyUsers`, `credentialRegistration`, `caPolicies`, `recentApps` e `serviceHealth`.

**O que falta no enriquecimento**: `signInLogs` e `auditLogs` nunca sao buscados via Graph API quando ha dados do agent. Isso causa zeros em:

| Modulo | Dados ausentes | Resultado |
|---|---|---|
| Seguranca e Risco | `signInLogs` | highRiskSignIns=0, mfaFailures=0, impossibleTravel=0, blockedAccounts=0 |
| Identidade | `auditLogs` + `signInLogs` | newUsers=0, serviceAccountInteractive=0 |
| Exchange Health | Dados ok (serviceHealth + EXO) | Pode estar correto (zero = sem incidentes) |
| Auditoria | `auditLogs` | adminAuditChanges=0, delegacoes=0, mailboxAudit=0 |

O Conditional Access funciona porque `caPolicies` esta no bloco de enriquecimento.

### Correcao

**Arquivo: `supabase/functions/m365-analyzer/index.ts`**

Expandir a condicao de enriquecimento (linha 1878) e adicionar chamadas para `signInLogs` e `auditLogs`:

1. Alterar condicao de entrada: trocar `riskyUsersData.length === 0 || caPolicies.length === 0` para incluir tambem `signInLogs.length === 0 || auditLogs.length === 0`

2. Adicionar duas chamadas Graph API ao bloco de enriquecimento:
   - `signInLogs`: `GET /v1.0/auditLogs/signIns?$top=500` (com filtro de periodo)
   - `auditLogs`: `GET /v1.0/auditLogs/directoryAudits?$top=500` (com filtro de periodo)

3. Processar os resultados e popular as variaveis se estiverem vazias

### Detalhes tecnicos

```text
Bloco atual (linha 1878):
  if (dataSource === 'agent' && (riskyUsersData === 0 || caPolicies === 0))
    -> busca: riskyUsers, credReg, caPolicies, recentApps, serviceHealth

Bloco corrigido:
  if (dataSource === 'agent' && (riskyUsersData === 0 || caPolicies === 0 || signInLogs === 0 || auditLogs === 0))
    -> busca: riskyUsers, credReg, caPolicies, recentApps, serviceHealth, signInLogs, auditLogs
```

O `Promise.all` sera expandido de 5 para 7 chamadas paralelas, mantendo o mesmo padrao de "so buscar se vazio".

### Resultado esperado

Apos deploy e nova execucao:
- **Seguranca e Risco**: sign-ins arriscados, falhas MFA, impossible travel, contas bloqueadas
- **Identidade**: novos usuarios, usuarios sem MFA, app registrations, service accounts interativos
- **Auditoria**: mudancas administrativas, delegacoes, acessos a mailbox
- **Exchange Health**: ja deve funcionar (serviceHealth ja era buscado)
