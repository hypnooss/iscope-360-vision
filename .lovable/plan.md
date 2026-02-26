

## Fase 3: Coleta de Dados Operacionais para M365 Analyzer

### Problema
O blueprint M365 Exchange Online coleta apenas configuracoes de politicas EXO (anti-phish, safe links, transport rules, etc). Faltam comandos PowerShell para dados operacionais que alimentam 5 dos 7 modulos do Analyzer:

| Modulo | Dado necessario | Status atual |
|--------|----------------|-------------|
| Phishing e Ameacas | Politicas EXO | OK (parcial) |
| Capacidade de Mailbox | Get-EXOMailboxStatistics | **FALTANDO** |
| Baseline Comportamental | Message Trace / email activity | **FALTANDO** |
| Comprometimento de Conta | Sign-in logs + inbox rules | **FALTANDO** (sign-in via Graph, inbox rules parcial) |
| Regras Suspeitas | Inbox rules + forwarding | OK (parcial) |
| Exfiltracao | Message Trace outbound | **FALTANDO** |
| Riscos Operacionais | Org config + sign-in logs | Parcial |

### Solucao

#### 1. Adicionar steps PowerShell ao blueprint Exchange Online

Novos steps a inserir na tabela `device_blueprints` (no campo `collection_steps.steps`):

**Step: exo_mailbox_statistics**
```
Get-EXOMailboxStatistics -ResultSize 500 | 
  Select-Object DisplayName, ItemCount, TotalItemSize, 
  LastLogonTime, MailboxTypeDetail
```
- Alimenta: modulo Mailbox Capacity

**Step: exo_mailbox_quota**
```
Get-Mailbox -ResultSize 500 | 
  Select-Object DisplayName, PrimarySmtpAddress, 
  ProhibitSendQuota, ProhibitSendReceiveQuota, 
  IssueWarningQuota, UseDatabaseQuotaDefaults
```
- Alimenta: modulo Mailbox Capacity (calculo de percentual)

**Step: exo_message_trace**  
```
Get-MessageTrace -StartDate (Get-Date).AddHours(-24) -EndDate (Get-Date) -PageSize 5000 |
  Select-Object Received, SenderAddress, RecipientAddress, 
  Subject, Status, Size, MessageTraceId
```
- Alimenta: modulos Behavioral Baseline, Exfiltration, Email Activity

**Step: exo_inbox_rules**
```
Get-Mailbox -ResultSize 500 | ForEach-Object { 
  Get-InboxRule -Mailbox $_.PrimarySmtpAddress -ErrorAction SilentlyContinue | 
  Select-Object MailboxOwnerId, Name, Enabled, ForwardTo, 
  ForwardAsAttachmentTo, RedirectTo, DeleteMessage, MoveToFolder
} | Where-Object { $_ -ne $null }
```
- Alimenta: modulos Suspicious Rules, Account Compromise

**Step: exo_auth_policy** (opcional, reforco para Riscos Operacionais)
```
Get-AuthenticationPolicy | Select-Object Name, 
  AllowBasicAuthSmtp, AllowBasicAuthImap, AllowBasicAuthPop
```
- Alimenta: modulo Operational Risks (legacy protocols)

#### 2. Atualizar m365-analyzer para mapear os novos steps

Arquivo: `supabase/functions/m365-analyzer/index.ts`

Acoes:
- Adicionar mapeamento de `exo_mailbox_statistics` + `exo_mailbox_quota` para o modulo `analyzeMailboxCapacity`
  - Cruzar `TotalItemSize` de statistics com `ProhibitSendReceiveQuota` de quota por `DisplayName/PrimarySmtpAddress`
  - Converter `TotalItemSize` (string como "1.234 GB") para bytes
- Adicionar mapeamento de `exo_message_trace` para:
  - `emailActivity` (agregado por usuario: count de sent/received)
  - Modulo `analyzeExfiltration` (volume externo por dominio)
  - Modulo `analyzeBehavioralBaseline` (sent count por usuario)
- Adicionar mapeamento de `exo_inbox_rules` para `inboxRules` (complementar ao forwarding existente)
- Adicionar mapeamento de `exo_auth_policy` para `analyzeOperationalRisks`

#### 3. Logica de parsing especifica

O `TotalItemSize` do PowerShell vem em formato string como `"1.234 GB (1,324,567,890 bytes)"`. O parser precisa:
- Extrair bytes via regex `\(([0-9,]+) bytes\)`
- Fallback: converter "X.XXX GB" para bytes

O `ProhibitSendReceiveQuota` vem como `"49.5 GB (53,150,220,288 bytes)"` ou `"Unlimited"`.

#### 4. Resultado esperado

Apos update do blueprint + redeploy do analyzer:
- Proxima execucao trara dados de mailbox (capacidade, top mailboxes)
- Message trace gerara insights de exfiltracao e behavioral
- Inbox rules complementarao deteccao de regras suspeitas
- Os 7 modulos terao dados reais em vez de zerados

#### Arquivos impactados
- Blueprint no banco (UPDATE via SQL na tabela `device_blueprints`)
- `supabase/functions/m365-analyzer/index.ts` (novos mappings + parser de TotalItemSize)

#### Risco
- Comandos PowerShell podem ter volume alto em tenants grandes (ResultSize 500 mitiga)
- Message Trace limitado a 24h (suficiente para snapshot horario)
- `Get-InboxRule` por mailbox pode ser lento em tenants com muitas caixas (ForEach com ErrorAction SilentlyContinue mitiga)
