

## Enriquecer 6 categorias do Entra ID Analyzer com detalhamento, visualização e exportação

### Situação atual

Os dados user-level só existem para MFA (`mfa.userDetails`). As demais categorias retornam apenas contagens agregadas. Para replicar o padrão MFA (abas + lista de usuários + barra proporcional + exportação Excel), é necessário:

1. **Expandir a Edge Function** para retornar detalhes por usuário/evento em cada categoria
2. **Atualizar o tipo `EntraIdDashboardData`** com os novos arrays
3. **Criar componentes de lista reutilizáveis** (ou generalizar o `MfaUserList`)
4. **Redesenhar cada caso no Sheet** com abas, métricas, barras e botão Exportar
5. **Atualizar os cards do grid** com splits proporcionais

---

### 1. Edge Function — novos dados por categoria

**`supabase/functions/entra-id-dashboard/index.ts`**

Adicionar queries paralelas e mapear detalhes:

| Categoria | Fonte já disponível | Ação necessária |
|---|---|---|
| **Identity Risk** | `riskyUsersData.value` já contém objetos completos | Mapear `riskDetails[]` com `displayName`, `upn`, `riskLevel`, `riskState`, `riskLastUpdatedDateTime` |
| **Failed Logins** | `signInLogs` já contém eventos completos | Mapear `loginDetails[]` com `userDisplayName`, `upn`, `status`, `errorCode`, `location`, `appDisplayName`, `createdDateTime`, segmentado por sucesso/falha/bloqueado |
| **Administrators** | `directoryRoles` com `$expand=members` já traz membros | Mapear `adminDetails[]` com `displayName`, `upn`, `roles[]` (nomes das roles do admin) |
| **Disabled Accounts** | Atualmente só `$count` | Adicionar query: `users?$filter=accountEnabled eq false&$select=displayName,userPrincipalName,createdDateTime&$top=999` |
| **Guest Users** | Atualmente só `$count` | Adicionar query: `users?$filter=userType eq 'Guest'&$select=displayName,userPrincipalName,mail,createdDateTime&$top=999` |
| **Password Activity** | `auditLogs7d` já contém eventos | Mapear `passwordDetails[]` com `activityDisplayName`, `targetUser`, `initiatedBy`, `activityDateTime`, classificado por tipo |

Estrutura de saída adicionada ao `result`:
```text
risks.details[]        → { displayName, upn, riskLevel, riskState, lastUpdated }
loginActivity.details[] → { displayName, upn, status, errorCode, location, app, createdDateTime }
admins.details[]       → { displayName, upn, roles[] }
users.disabledDetails[] → { displayName, upn, createdDateTime }
users.guestDetails[]   → { displayName, upn, mail, createdDateTime }
passwordActivity.details[] → { activity, targetUser, initiatedBy, activityDateTime }
```

### 2. Tipo TypeScript — `useEntraIdDashboard.ts`

Expandir `EntraIdDashboardData` com os novos arrays opcionais em cada sub-objeto.

### 3. Componente genérico de lista — `UserDetailList.tsx`

Criar um componente reutilizável similar ao `MfaUserList` mas genérico:
- Props: `items[]`, `columns[]` (label + accessor), `searchKeys[]`, busca + limite 10 + "use a busca para ver todos"
- Usado por todas as 6 categorias

### 4. Sheet — redesenho de cada categoria

Cada categoria segue o padrão MFA:

**Identity Risk** — Abas: Status Geral | Em Risco | Comprometidos | Exportar
- Status Geral: 3 MetricCards (Total, Em Risco, Comprometidos) + ProportionalBar
- Listas filtradas por `riskState`

**Failed Logins** — Abas: Status Geral | Sucesso | Falhas | Bloqueados | Exportar
- Status Geral: 5 MetricCards + ProportionalBar (sucesso/falha/bloqueado)
- Listas filtradas por status

**Administrators** — Abas: Status Geral | Lista Completa | Global Admins | Exportar
- Status Geral: MetricCards (Total, Global Admins) + ProportionalBar
- Listas com badges de roles

**Disabled Accounts** — Abas: Status Geral | Lista | Exportar
- MetricCards (Total, % do diretório) + barra
- Lista pesquisável

**Guest Users** — Abas: Status Geral | Lista | Exportar
- MetricCards (Total, % do diretório) + barra
- Lista pesquisável com email

**Password Activity** — Abas: Status Geral | Resets | Self-Service | Forçados | Exportar
- MetricCards por tipo + ProportionalBar
- Listas filtradas por tipo de atividade

Cada aba inclui botão Exportar (xlsx) com todos os registros da categoria, usando o mesmo padrão do MFA.

### 5. Grid cards — splits proporcionais

Atualizar `getCategoryStats` para retornar `splits[]` em cada categoria (mesmo padrão do MFA), com badges coloridas:

- **Identity Risk**: Em Risco (orange) / Comprometidos (red)
- **Failed Logins**: Sucesso (emerald) / Falhas (amber) / Bloqueados (red)
- **Administrators**: Global (amber) / Outros (violet)
- **Disabled**: Habilitados (emerald) / Desabilitados (indigo)
- **Guests**: Membros (teal) / Convidados (pink)
- **Password**: Resets (orange) / Self-Service (blue) / Forçados (red)

### Resumo de arquivos alterados

| Arquivo | Ação |
|---|---|
| `supabase/functions/entra-id-dashboard/index.ts` | Adicionar 2 queries + mapear 6 arrays de detalhes |
| `src/hooks/useEntraIdDashboard.ts` | Expandir interface com tipos dos novos arrays |
| `src/components/m365/entra-id/UserDetailList.tsx` | **Novo** — componente genérico de lista pesquisável |
| `src/components/m365/entra-id/EntraIdCategorySheet.tsx` | Redesenhar 6 casos com abas + métricas + barras + exportação |
| `src/components/m365/entra-id/EntraIdAnalyzerCategoryGrid.tsx` | Atualizar `getCategoryStats` para usar `splits[]` nos 6 cards |

