

## Reestruturar M365 Analyzer: Cobertura Completa de Segurança

### Problema Atual

O Analyzer tem 7 categorias focadas em Exchange Online (phishing, mailbox, behavioral, compromise, rules, exfiltration, operational). Faltam verificações fundamentais de **Entra ID** (identidade, MFA, Conditional Access) e **Auditoria/Compliance**.

### Nova Estrutura de Categorias

| # | Categoria | Slug | O que cobre |
|---|-----------|------|-------------|
| 1 | Seguranca e Risco | `security_risk` | Sign-ins de alto risco, falhas MFA, impossible travel, contas bloqueadas, quarentena, spam |
| 2 | Identidade e Acesso | `identity_access` | Novos usuarios, desabilitados, sem MFA, sem CA, service accounts, app registrations |
| 3 | Conditional Access | `conditional_access` | Politicas desabilitadas, exclusoes, report-only, novas politicas |
| 4 | Saude Exchange Online | `exchange_health` | Service health, message trace falhas, shared mailboxes sem owner, conectores |
| 5 | Auditoria e Compliance | `audit_compliance` | Mailbox audit, admin audit, delegacoes, e-discovery |
| 6 | Phishing e Ameacas | `phishing_threats` | (existente - mantido) |
| 7 | Capacidade de Mailbox | `mailbox_capacity` | (existente - mantido) |
| 8 | Baseline Comportamental | `behavioral_baseline` | (existente - mantido) |
| 9 | Comprometimento de Conta | `account_compromise` | (existente - enriquecido com dados de risco) |
| 10 | Regras Suspeitas | `suspicious_rules` | (existente - mantido) |
| 11 | Exfiltracao | `exfiltration` | (existente - mantido) |
| 12 | Riscos Operacionais | `operational_risks` | (existente - mantido) |

### Mudancas por Arquivo

#### 1. `src/types/m365AnalyzerInsights.ts`
- Adicionar as 5 novas categorias ao type `M365AnalyzerCategory`
- Adicionar labels em portugues ao `M365_ANALYZER_CATEGORY_LABELS`
- Adicionar ao array `M365_ANALYZER_CATEGORIES`
- Expandir `M365AnalyzerMetrics` com novos campos:
  - `identity`: `newUsers`, `disabledUsers`, `noMfaUsers`, `noConditionalAccess`, `serviceAccountInteractive`, `recentAppRegistrations`
  - `conditionalAccess`: `disabledPolicies`, `reportOnlyPolicies`, `excludedUsers`, `recentlyCreated`
  - `exchangeHealth`: `serviceIncidents`, `messageTraceFailures`, `sharedMailboxesNoOwner`, `connectorFailures`
  - `audit`: `mailboxAuditAlerts`, `adminAuditChanges`, `newDelegations`, `activeEdiscovery`

#### 2. `supabase/functions/m365-analyzer/index.ts`
Adicionar novas chamadas Graph API e novos modulos de analise:

**Novas chamadas Graph API** (no bloco de fallback/enriquecimento):
- `GET /identityProtection/riskyUsers` - usuarios com risco ativo
- `GET /reports/credentialUserRegistrationDetails` - status MFA dos usuarios
- `GET /identity/conditionalAccess/policies` - politicas de CA
- `GET /auditLogs/signIns?$filter=status/errorCode ne 0` - falhas de sign-in (MFA, bloqueios)
- `GET /auditLogs/directoryAudits?$filter=activityDisplayName eq 'Add user'` - novos usuarios
- `GET /applications?$orderby=createdDateTime desc&$top=50` - app registrations recentes
- `GET /admin/serviceAnnouncement/issues` - service health

**Novo modulo `analyzeSecurityRisk()`**:
- Sign-ins de alto risco (riskLevel = high/medium dos signInLogs)
- Falhas de MFA (errorCode 50074, 50076, 53003 dos signInLogs)
- Impossible travel (multiplos paises em janela curta)
- Contas bloqueadas (errorCode 50053 dos signInLogs)
- Volume de quarentena (se disponivel)

**Novo modulo `analyzeIdentityAccess()`**:
- Novos usuarios criados (directoryAudits com activityDisplayName='Add user')
- Usuarios desabilitados (activityDisplayName='Disable account')
- Contas sem MFA registrado (credentialUserRegistrationDetails)
- Service accounts com login interativo
- App registrations recentes nao autorizadas

**Novo modulo `analyzeConditionalAccess()`**:
- Politicas com state='disabled'
- Politicas com state='enabledForReportingButNotEnforced'
- Usuarios/grupos em excludeUsers
- Politicas criadas recentemente (via audit logs)

**Novo modulo `analyzeExchangeHealth()`**:
- Incidentes ativos do Service Health
- Falhas de message trace (status != 'Delivered')
- Shared mailboxes sem owner (RecipientTypeDetails = 'SharedMailbox' sem delegates)
- Problemas em conectores (se dados disponiveis do EXO)

**Novo modulo `analyzeAuditCompliance()`**:
- Deteccao de acesso indevido via mailbox audit
- Mudancas administrativas criticas (reset senha, alteracao de roles)
- Novas delegacoes de mailbox (Add-MailboxPermission)
- E-discovery cases ativos (se disponivel via Graph)

**Enriquecer modulo existente `analyzeAccountCompromise()`**:
- Integrar dados de `riskyUsers` do Identity Protection
- Correlacionar com falhas de MFA

#### 3. `src/hooks/useM365AnalyzerData.ts`
- Atualizar `defaultMetrics` com os novos campos (identity, conditionalAccess, exchangeHealth, audit)
- Atualizar `parseMetrics` para normalizar os novos campos

#### 4. `src/pages/m365/M365AnalyzerDashboardPage.tsx`
- Adicionar icones para as novas categorias (Shield, Key, Fingerprint, HeartPulse, ClipboardCheck)
- Expandir os cards de metricas para mostrar os novos indicadores
- As novas categorias aparecerao automaticamente nas tabs existentes (ja usa `M365_ANALYZER_CATEGORIES` do types)
- Adicionar uma secao de "Resumo Executivo" no topo com os indicadores mais criticos de cada area

#### 5. `supabase/functions/trigger-m365-analyzer/index.ts`
- Adicionar as novas categorias ao `analysis_modules` no payload:
  - `security_risk`, `identity_access`, `conditional_access`, `exchange_health`, `audit_compliance`

### Dados que ja existem vs. novos

| Dado | Fonte atual | Acao |
|------|-------------|------|
| Sign-in logs | Graph API + Agent | Extrair mais campos (errorCode, riskLevel) |
| Risky users | Nao coletado | Nova chamada Graph API |
| MFA registration | Nao coletado | Nova chamada Graph API |
| Conditional Access policies | Nao coletado | Nova chamada Graph API |
| Service health | Nao coletado | Nova chamada Graph API |
| Audit logs (directory) | Graph API | Ja existe, filtrar melhor |
| EXO shared mailboxes | Parcial no agent | Usar dados existentes + nova analise |
| EXO message trace | Agent PowerShell | Ja coletado, analisar falhas |

### Ordem de Implementacao

1. Atualizar types e categorias (tipos + labels)
2. Atualizar edge function `m365-analyzer` com novos modulos de analise e chamadas Graph API
3. Atualizar `trigger-m365-analyzer` com novas categorias no payload
4. Atualizar hook `useM365AnalyzerData` para parsear novas metricas
5. Atualizar dashboard para exibir novas categorias e metricas

