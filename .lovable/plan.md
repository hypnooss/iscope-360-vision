

## Plano: Nova Tela Rica do Entra ID (Dashboard Operacional)

### Objetivo

Transformar a página `/scope-m365/entra-id` de uma lista de compliance em um **dashboard operacional rico** inspirado no print de referência, com 3 colunas de informação: inventário de identidades, segurança/MFA e atividade de auditoria.

### Arquitetura

A página chamará a edge function `entra-id-security-insights` (que já coleta sign-in logs, audit logs, MFA status e directory roles da Graph API) e apresentará os dados em cards visuais com gráficos donut (Recharts).

### Dados Disponíveis (já coletados pela edge function)

| Seção | Fonte Graph API | Métricas |
|---|---|---|
| **Entra ID (Identidades)** | `users`, `directoryRoles` | Total Users, Disabled, Guests, Admin Users, Global Admins |
| **Security (MFA)** | `userRegistrationDetails` | MFA Enabled/Disabled, Not Synced, donut chart |
| **Azure AD Risks** | `signInLogs` (riskState) | Risky Users, Compromised, Detected Risks |
| **Audit Activity** | `directoryAudits` | User Changes (New/Updated/Enabled/Disabled/Deleted), Password Resets, Group Changes |
| **Login Activity** | `signInLogs` | Donut por resultado (Success/Failure/MFA Required) |

### Alterações

#### 1. Nova Edge Function: `entra-id-dashboard` (ou adaptar `entra-id-security-insights`)

Criar uma nova edge function que retorna dados agregados/contadores em vez de insights individuais:

```ts
// Retorno esperado:
{
  users: { total, signInEnabled, disabled, guests, onPremSynced },
  admins: { total, globalAdmins, disabledAdmins, passwordNeverExpires },
  mfa: { total, enabled, disabled, notSynced },
  risks: { riskyUsers, compromised, riskyServicePrincipals, detectedRisks },
  auditActivity: { 
    userChanges: { updated, new, enabled, disabled, deleted },
    passwordActivity: { resets, forcedChanges, newGuestUser, newGlobalAdmin },
    groupChanges: { added, removed, updated }
  },
  loginActivity: { loggedIn, failed, mfaRequired, blocked }
}
```

Endpoints Graph API necessários (maioria já usados na edge function existente):
- `GET /users?$count=true` (com ConsistencyLevel: eventual)
- `GET /directoryRoles?$expand=members`
- `GET /reports/authenticationMethods/userRegistrationDetails`
- `GET /auditLogs/signIns` (já coletado)
- `GET /auditLogs/directoryAudits` (já coletado)
- `GET /identityProtection/riskyUsers` (novo - requer P2)

#### 2. Novo Hook: `src/hooks/useEntraIdDashboard.ts`

Chama a nova edge function e retorna os dados tipados para o dashboard.

#### 3. Página: `src/pages/m365/EntraIdPage.tsx` (reescrita completa)

Layout em 3 colunas (desktop) com os seguintes cards:

**Coluna 1 - Entra ID (Identidades):**
- Card "Entra ID" com lista de métricas (Users, Sign-In Enabled, Disabled, Guests, On-Prem Synced)
- Card "Admins" (Total, Global Admins, Disabled Admins, Password Never Expires)

**Coluna 2 - Security:**
- Card "MFA User Status" com donut chart (Enabled vs Disabled)
- Card "Azure AD Risks (30 Days)" com métricas de risco

**Coluna 3 - Audit Activity:**
- Card "User Changes (30 Days)" com donut chart por tipo de mudança
- Card "Login Activity (30 Days)" com donut chart por resultado
- Card "Password Audit Activity in 7 Days"

Componentes visuais:
- Donut charts usando Recharts (PieChart/Pie) - já usado no projeto
- Cards com `Card`/`CardContent` do shadcn
- Lista de métricas com label + valor alinhado à direita
- Cores consistentes com o tema dark do projeto

#### 4. Novos Componentes em `src/components/m365/entra-id/`:

- `EntraIdStatsCard.tsx` — Card genérico com lista de métricas (label/valor)
- `EntraIdDonutChart.tsx` — Donut chart reutilizável com legenda
- `EntraIdDashboard.tsx` — Grid principal com as 3 colunas

### Arquivos

1. **Novo:** `supabase/functions/entra-id-dashboard/index.ts` — Edge function que agrega dados do Graph API
2. **Novo:** `src/hooks/useEntraIdDashboard.ts` — Hook para chamar a edge function
3. **Novo:** `src/components/m365/entra-id/EntraIdStatsCard.tsx` — Card de métricas
4. **Novo:** `src/components/m365/entra-id/EntraIdDonutChart.tsx` — Donut chart component
5. **Reescrito:** `src/pages/m365/EntraIdPage.tsx` — Dashboard completo com 3 colunas

