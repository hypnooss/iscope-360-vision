
# Plano: Expansao Massiva de Verificacoes M365 (30+ Checks)

## Situacao Atual

A Edge Function `m365-security-posture` possui apenas **7 verificacoes**:
- IDT-001: MFA Status
- ADM-001: Quantidade de Global Admins
- ADM-002: Admins sem MFA
- AUT-001: Security Defaults
- APP-001: Credenciais expirando
- APP-002: Credenciais expiradas
- EXO-001: Regras de forwarding

## Verificacoes a Implementar (25+ novas)

### Categoria: Identidades (identities)

| Codigo | Verificacao | Endpoint Graph API |
|--------|-------------|-------------------|
| IDT-002 | Usuarios inativos >90 dias | `/users?$filter=signInActivity/lastSignInDateTime lt {date}` |
| IDT-003 | Usuarios convidados (guests) sem sponsor | `/users?$filter=userType eq 'Guest'` |
| IDT-004 | Usuarios guests inativos >60 dias | `/users?$filter=userType eq 'Guest'` + signInActivity |
| IDT-005 | Usuarios com senha expirada | `/users?$select=passwordPolicies,lastPasswordChangeDateTime` |
| IDT-006 | Usuarios bloqueados ainda ativos | `/users?$filter=accountEnabled eq false` |

### Categoria: Autenticacao e Acesso (auth_access)

| Codigo | Verificacao | Endpoint Graph API |
|--------|-------------|-------------------|
| AUT-002 | Conditional Access Policies ausentes | `/identity/conditionalAccess/policies` |
| AUT-003 | Sign-ins de risco (ultimos 7 dias) | `/identityProtection/riskDetections` |
| AUT-004 | Usuarios de risco ativos | `/identityProtection/riskyUsers` |
| AUT-005 | Self-service password reset desabilitado | `/policies/authenticationMethodsPolicy` |
| AUT-006 | Legacy authentication permitida | Verificar CA policies |
| AUT-007 | Politica de bloqueio de conta fraca | `/policies/authenticationFlowsPolicy` |

### Categoria: Privilegios Administrativos (admin_privileges)

| Codigo | Verificacao | Endpoint Graph API |
|--------|-------------|-------------------|
| ADM-003 | Roles privilegiadas permanentes (sem PIM) | `/directoryRoles` + assignment type |
| ADM-004 | Service accounts com roles admin | `/servicePrincipals` + role assignments |
| ADM-005 | Guests com roles administrativas | `/directoryRoles/*/members?$filter=userType eq 'Guest'` |
| ADM-006 | Roles sem protecao PIM | `/privilegedAccess/aadroles` |

### Categoria: Aplicacoes e Integracoes (apps_integrations)

| Codigo | Verificacao | Endpoint Graph API |
|--------|-------------|-------------------|
| APP-003 | Apps com permissoes excessivas (high privilege) | `/applications?$select=requiredResourceAccess` |
| APP-004 | Service Principals inativos | `/servicePrincipals` + signInActivity |
| APP-005 | OAuth apps de terceiros arriscados | `/oauth2PermissionGrants` |
| APP-006 | Apps sem owner definido | `/applications?$expand=owners` |
| APP-007 | Consent grants para aplicacoes externas | `/oauth2PermissionGrants?$filter=consentType eq 'AllPrincipals'` |

### Categoria: Email e Exchange (email_exchange)

| Codigo | Verificacao | Endpoint Graph API |
|--------|-------------|-------------------|
| EXO-002 | Auto-forwarding externo habilitado globalmente | `/admin/exchange/settings` |
| EXO-003 | Mailboxes com delegacao suspeita | `/users/{id}/mailboxSettings` |
| EXO-004 | Audit log desabilitado | `/admin/serviceAnnouncement/healthOverviews` |
| EXO-005 | Transport rules arriscadas | `/admin/exchange/transportRules` |

### Categoria: Ameacas e Atividades (threats_activity)

| Codigo | Verificacao | Endpoint Graph API |
|--------|-------------|-------------------|
| THR-001 | Sign-ins de paises incomuns | `/auditLogs/signIns?$filter=location/countryOrRegion ne 'BR'` |
| THR-002 | Tentativas de brute force detectadas | `/identityProtection/riskDetections?$filter=riskEventType eq 'unfamiliarFeatures'` |
| THR-003 | Usuarios comprometidos confirmados | `/identityProtection/riskyUsers?$filter=riskState eq 'atRisk'` |
| THR-004 | Alertas de seguranca ativos | `/security/alerts` |
| THR-005 | Anomalias de login (horarios incomuns) | `/auditLogs/signIns` + analise temporal |

## Arquitetura Modular

Devido ao limite de tamanho da Edge Function, sera necessario dividir em:

```
supabase/functions/
├── m365-security-posture/index.ts      # Orquestrador principal
├── m365-collectors-identity/index.ts    # IDT-001 a IDT-006
├── m365-collectors-auth/index.ts        # AUT-001 a AUT-007
├── m365-collectors-admin/index.ts       # ADM-001 a ADM-006
├── m365-collectors-apps/index.ts        # APP-001 a APP-007
├── m365-collectors-exchange/index.ts    # EXO-001 a EXO-005
└── m365-collectors-threats/index.ts     # THR-001 a THR-005
```

**Alternativa (preferida)**: Manter uma unica Edge Function mas com coletores inline otimizados para evitar timeout de bundle.

## Permissoes Graph API Necessarias

Verificar se o App Registration tem estas permissoes:
- `User.Read.All` - Usuarios e sign-in activity
- `AuditLog.Read.All` - Logs de auditoria
- `Policy.Read.All` - Politicas de CA e auth
- `Directory.Read.All` - Roles e membros
- `IdentityRiskEvent.Read.All` - Deteccoes de risco
- `IdentityRiskyUser.Read.All` - Usuarios de risco
- `Application.Read.All` - Aplicacoes registradas
- `SecurityEvents.Read.All` - Alertas de seguranca
- `MailboxSettings.Read` - Configuracoes de email

## Estrategia de Implementacao

### Fase 1: Core Checks (10 verificacoes)
Adicionar as verificacoes mais criticas que usam endpoints ja disponiveis:
- IDT-002 (usuarios inativos)
- IDT-003 (guests sem sponsor)
- AUT-002 (CA policies)
- AUT-004 (risky users)
- ADM-003 (roles permanentes)
- ADM-005 (guests admin)
- APP-003 (permissoes excessivas)
- APP-006 (apps sem owner)
- THR-003 (usuarios comprometidos)
- THR-004 (alertas ativos)

### Fase 2: Extended Checks (10 verificacoes)
- IDT-004, IDT-005, IDT-006
- AUT-003, AUT-005, AUT-006
- ADM-004, ADM-006
- APP-004, APP-005

### Fase 3: Advanced Checks (10 verificacoes)
- AUT-007
- APP-007
- EXO-002, EXO-003, EXO-004, EXO-005
- THR-001, THR-002, THR-005

## Arquivos a Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/m365-security-posture/index.ts` | Expandir com 25+ coletores |
| `src/types/m365Insights.ts` | Adicionar constantes para novos checks |

## Consideracoes Tecnicas

1. **Bundle Timeout**: O codigo sera otimizado para evitar timeouts
   - Coletores inline sem imports externos
   - Promise.allSettled para paralelismo
   - Timeout individual por coletor (10s)

2. **Rate Limiting**: Graph API tem limites
   - Batch requests onde possivel
   - Delays entre chamadas se necessario

3. **Permissoes**: Alguns endpoints requerem licenca P2
   - Verificar permissoes disponiveis
   - Graceful degradation se falhar

4. **Exibicao**: UI atual ja suporta multiplos insights
   - Cards de categoria mostrarao mais itens
   - Breakdown de severidade mais detalhado

## Resultado Esperado

- **Antes**: 7 verificacoes, cobertura limitada
- **Depois**: 30+ verificacoes cobrindo todas as 6 categorias
- Score mais preciso e representativo
- Dashboard rico com insights acionaveis por categoria
