

## Corrigir cards OK em Entra ID Analyzer e Colaboração Analyzer

### Diagnóstico com dados reais

**Entra ID Analyzer** — O snapshot mais recente tem **15 insights**, mas apenas **2 são pass** (`safe_links_ok` e `safe_attachments_ok`), ambos da categoria `phishing_threats` (Exchange). As categorias Entra (`security_risk`, `identity_access`, `conditional_access`, `account_compromise`, `operational_risks`) não possuem **nenhum insight pass** porque a lógica atual gera pass apenas como catch-all quando o módulo inteiro não tem problemas (`if (insights.length === 0)`). Como há falhas reais nessas categorias, o catch-all nunca é acionado.

O módulo `phishing_threats` funciona diferente: gera pass **por sub-check** (`safe_links_ok`, `safe_attachments_ok`) independentemente de outras falhas no mesmo módulo. Essa é a lógica que precisa ser replicada nos módulos Entra.

**Colaboração Analyzer** — O `collaboration-dashboard` possui a lógica de insights no código, porém os snapshots no banco têm `data->'insights' = null`. A edge function precisa ser redeployada para que os novos snapshots incluam os insights. O frontend (`useCollaborationDashboard` e `TeamsAnalyzerPage`) já lê e exibe insights corretamente.

### Solução

#### 1. `supabase/functions/m365-analyzer/index.ts` — Adicionar pass insights granulares

Em cada módulo Entra, gerar pass insights **por sub-check** que passou, mesmo quando o módulo tem falhas:

| Módulo | Pass insights a adicionar |
|---|---|
| `analyzeSecurityRisk` | "Nenhum Usuário de Alto Risco" (se `riskyUsersData` sem high risk), "Nenhum Impossible Travel" (se não detectado), "Nenhuma Conta Bloqueada" (se blockedUsers vazio) |
| `analyzeIdentityAccess` | "Nenhum Service Account Interativo" (se serviceAccounts vazio), "App Registrations em Conformidade" (se sem recentes) |
| `analyzeConditionalAccess` | "Nenhuma Política Desabilitada" (se disabledPolicies === 0), "Nenhuma Exclusão Excessiva" |
| `analyzeOperationalRisks` | "SMTP Auth Desabilitado" (se smtpAuth === 0), "Sem Protocolos Legados" (se legacyProtocols === 0) |

Padrão: mover o catch-all existente (`if (insights.length === 0)`) para inserções granulares ao longo da função, exatamente como já feito em `analyzePhishingThreats`.

#### 2. `supabase/functions/collaboration-dashboard/index.ts` — Redeploy

O código já gera insights. Apenas redeployar para garantir que o código atual está ativo.

#### 3. Nenhuma alteração no frontend

O frontend já está correto:
- `EntraIdAnalyzerPage`: filtra por `ENTRA_OPERATIONAL_CATEGORIES`, `isConfigurationalInsight` já ignora pass insights
- `TeamsAnalyzerPage`: merge de `analyzerTeamsInsights` + `collaborationInsights` do dashboard
- `SecurityInsightCard`: renderiza cards pass com borda verde e badge OK

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/m365-analyzer/index.ts` | Adicionar pass insights granulares em `analyzeSecurityRisk`, `analyzeIdentityAccess`, `analyzeConditionalAccess`, `analyzeOperationalRisks` |

Após implementar, será necessário executar nova análise para popular os snapshots com os novos insights pass.

