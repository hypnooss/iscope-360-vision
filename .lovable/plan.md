
# Plano: Nova Secao Aplicativos (Entra ID)

## Visao Geral

Criar uma nova secao **Aplicativos** no modulo Entra ID, seguindo **exatamente** o padrao visual e arquitetural da secao **Insights de Seguranca** existente. A secao analisara App Registrations e Enterprise Applications com foco em riscos de seguranca, expiracao de credenciais e governanca.

---

## Arquitetura da Solucao

A implementacao seguira a mesma estrutura da secao Security Insights:

```text
+----------------------------------------------------------+
|                    ARQUITETURA                           |
+----------------------------------------------------------+
|                                                          |
|  Frontend                                                |
|  +----------------------------------------------------+  |
|  | EntraIdApplicationInsightsPage.tsx                 |  |
|  |   - Reutiliza InsightSummaryCards                  |  |
|  |   - Usa AppInsightCategorySection (novo)           |  |
|  |   - Usa AppInsightCard (novo)                      |  |
|  +----------------------------------------------------+  |
|                         |                                |
|                         v                                |
|  +----------------------------------------------------+  |
|  | useEntraIdApplicationInsights.ts (hook)            |  |
|  |   - Chama edge function                            |  |
|  |   - Gerencia estado (loading, error, data)         |  |
|  +----------------------------------------------------+  |
|                         |                                |
|                         v                                |
|  Backend (Edge Function)                                 |
|  +----------------------------------------------------+  |
|  | entra-id-application-insights/index.ts             |  |
|  |   - Busca apps via Microsoft Graph API             |  |
|  |   - Analisa credenciais e permissoes               |  |
|  |   - Gera insights de risco                         |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

---

## Categorias de Insights

Os insights serao agrupados em 3 categorias (mesmo padrao dos Security Insights):

| Categoria | Codigo | Descricao |
|-----------|--------|-----------|
| `credential_expiration` | Expiracao de Credenciais | Secrets/Certificados vencidos ou proximos do vencimento |
| `privileged_permissions` | Permissoes Privilegiadas | Apps com permissoes criticas ou Admin Consent |
| `security_hygiene` | Higiene de Seguranca | Apps inativos, sem rotacao, multiplas credenciais |

---

## Insights a Implementar

### Categoria: Expiracao de Credenciais

| Codigo | Titulo | Severidade | Criterio |
|--------|--------|------------|----------|
| APP-001 | Credenciais vencidas | Critico | Secrets/Certs com `endDateTime` < hoje |
| APP-002 | Credenciais a vencer em 30 dias | Alto | Secrets/Certs com `endDateTime` entre hoje e +30d |
| APP-003 | Credenciais a vencer em 90 dias | Medio | Secrets/Certs com `endDateTime` entre +30d e +90d |

### Categoria: Permissoes Privilegiadas

| Codigo | Titulo | Severidade | Criterio |
|--------|--------|------------|----------|
| APP-004 | Apps com permissoes criticas | Critico | Apps com `Directory.ReadWrite.All`, `Application.ReadWrite.All`, `RoleManagement.ReadWrite.Directory` |
| APP-005 | Apps com Admin Consent | Alto | Apps cujo Service Principal possui `oauth2PermissionGrants` com `consentType: AllPrincipals` |
| APP-006 | Apps com permissoes de leitura global | Medio | Apps com `Directory.Read.All`, `User.Read.All`, `Group.Read.All` |

### Categoria: Higiene de Seguranca

| Codigo | Titulo | Severidade | Criterio |
|--------|--------|------------|----------|
| APP-007 | Apps sem credencial redundante | Medio | Apps com apenas 1 credencial ativa (sem backup) |
| APP-008 | Credenciais sem rotacao (>1 ano) | Alto | Secrets/Certs criados ha mais de 365 dias e ainda ativos |
| APP-009 | Apps sem owner definido | Baixo | App Registrations sem proprietario atribuido |

---

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/types/applicationInsights.ts` | Tipos TypeScript para Application Insights |
| `src/hooks/useEntraIdApplicationInsights.ts` | Hook para buscar dados da edge function |
| `src/pages/m365/EntraIdApplicationInsightsPage.tsx` | Pagina principal da secao |
| `src/components/m365/applications/AppInsightSummaryCards.tsx` | Cards de resumo (reutiliza estrutura existente) |
| `src/components/m365/applications/AppInsightCategorySection.tsx` | Secao colapsavel por categoria |
| `src/components/m365/applications/AppInsightCard.tsx` | Card individual de insight de app |
| `src/components/m365/applications/AppInsightDetailDialog.tsx` | Dialog de detalhes do insight |
| `supabase/functions/entra-id-application-insights/index.ts` | Edge function para buscar e analisar apps |

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/App.tsx` | Adicionar rota `/scope-m365/entra-id/applications` |
| `src/pages/m365/EntraIdPage.tsx` | Ativar card "Aplicativos" com link para nova rota |

---

## Detalhes Tecnicos

### 1. Tipos TypeScript (`src/types/applicationInsights.ts`)

```typescript
export type AppInsightCategory = 
  | 'credential_expiration' 
  | 'privileged_permissions' 
  | 'security_hygiene';

export type AppInsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AffectedApplication {
  id: string;
  appId: string;
  displayName: string;
  appType: 'AppRegistration' | 'EnterpriseApp';
  details?: {
    credentialType?: 'Secret' | 'Certificate';
    expiresAt?: string;
    daysUntilExpiration?: number;
    permissions?: string[];
    hasAdminConsent?: boolean;
    ownerCount?: number;
  };
}

export interface ApplicationInsight {
  id: string;
  code: string;
  title: string;
  description: string;
  category: AppInsightCategory;
  severity: AppInsightSeverity;
  affectedCount: number;
  affectedApplications: AffectedApplication[];
  criteria: string;
  recommendation: string;
  detectedAt: string;
}

export interface AppInsightsSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
  expiredCredentials: number;
  expiringIn30Days: number;
  privilegedApps: number;
}
```

### 2. Edge Function (`supabase/functions/entra-id-application-insights/index.ts`)

A edge function ira:

1. **Autenticar** com Microsoft Graph usando credenciais do tenant
2. **Buscar dados** via Graph API:
   - `GET /applications` - App Registrations
   - `GET /servicePrincipals` - Enterprise Apps
   - `GET /servicePrincipals/{id}/oauth2PermissionGrants` - Permissoes delegadas
   - `GET /servicePrincipals/{id}/appRoleAssignments` - App Roles
3. **Analisar** credenciais e permissoes
4. **Gerar insights** categorizados por severidade

Permissoes Graph necessarias:
- `Application.Read.All`
- `Directory.Read.All`

### 3. Layout da Pagina (mesmo padrao de Security Insights)

```text
+----------------------------------------------------------+
|                                                          |
|  [Breadcrumb] Microsoft 365 > Entra ID > Aplicativos     |
|                                                          |
|  APLICATIVOS                          [Atualizar]        |
|  Analise de riscos em App Registrations e Enterprise Apps|
|                                                          |
|  +-------------+  +-------------+  +-------------+       |
|  | Vencidos    |  | A Vencer    |  | Privilegiados|      |
|  | 3           |  | 7           |  | 12          |       |
|  | Credenciais |  | em 30 dias  |  | com Admin   |       |
|  +-------------+  +-------------+  +-------------+       |
|                                                          |
|  [TENANT: contoso.onmicrosoft.com]  [Conectado]          |
|                                                          |
|  +------------------------------------------------------+|
|  | EXPIRACAO DE CREDENCIAIS                     4 apps  ||
|  |   [Critico: 2] [Alto: 2]                             ||
|  +------------------------------------------------------+|
|     [Card] Credenciais vencidas                          |
|     [Card] Credenciais a vencer em 30 dias               |
|                                                          |
|  +------------------------------------------------------+|
|  | PERMISSOES PRIVILEGIADAS                    12 apps  ||
|  |   [Critico: 3] [Alto: 9]                             ||
|  +------------------------------------------------------+|
|     [Card] Apps com permissoes criticas                  |
|     [Card] Apps com Admin Consent                        |
|                                                          |
+----------------------------------------------------------+
```

### 4. Card de Insight (AppInsightCard)

O card seguira exatamente o mesmo padrao visual de `InsightCard`:

- Borda esquerda colorida por severidade
- Icone de severidade com background colorido
- Badge de severidade + codigo
- Titulo + descricao
- Contador de apps afetados (icone de cubo/app)
- Botao "Ver detalhes" que abre dialog

### 5. Dialog de Detalhes (AppInsightDetailDialog)

O dialog seguira o padrao de `InsightDetailDialog`:

- Header com severidade, codigo e categoria
- Descricao do insight
- Criterio de deteccao
- Recomendacao (destacada em amarelo)
- Lista de aplicativos afetados com:
  - Nome do app
  - Tipo (App Registration / Enterprise App)
  - Detalhes relevantes (data de expiracao, permissoes, etc.)

---

## Sequencia de Implementacao

| Etapa | Tarefa | Arquivos |
|-------|--------|----------|
| 1 | Criar tipos TypeScript | `src/types/applicationInsights.ts` |
| 2 | Criar Edge Function | `supabase/functions/entra-id-application-insights/index.ts` |
| 3 | Criar hook de dados | `src/hooks/useEntraIdApplicationInsights.ts` |
| 4 | Criar componentes de UI | `src/components/m365/applications/*.tsx` |
| 5 | Criar pagina principal | `src/pages/m365/EntraIdApplicationInsightsPage.tsx` |
| 6 | Adicionar rota e ativar menu | `src/App.tsx`, `src/pages/m365/EntraIdPage.tsx` |

---

## Permissoes Microsoft Graph Necessarias

Para que a edge function funcione, o App Registration do iScope no Entra ID do cliente precisa ter:

| Permissao | Tipo | Necessidade |
|-----------|------|-------------|
| `Application.Read.All` | Application | Obrigatoria |
| `Directory.Read.All` | Application | Obrigatoria |

Essas permissoes ja estao listadas na tabela `m365_required_permissions` do sistema.

---

## Cores e Estilos (Padrao Existente)

As cores de severidade seguem o padrao ja definido em `src/types/securityInsights.ts`:

- **Critico**: Red-500 (#EF4444)
- **Alto**: Orange-500 (#F97316)
- **Medio**: Amber-500 (#F59E0B)
- **Baixo**: Blue-500 (#3B82F6)
- **Info**: Slate-500 (#64748B)

As cores de categoria serao:

- **Expiracao de Credenciais**: Red/Rose (`bg-rose-500/10`, `text-rose-500`)
- **Permissoes Privilegiadas**: Purple (`bg-purple-500/10`, `text-purple-500`)
- **Higiene de Seguranca**: Cyan/Teal (`bg-cyan-500/10`, `text-cyan-500`)

---

## Resultado Esperado

- Secao "Aplicativos" acessivel em `/scope-m365/entra-id/applications`
- Card na pagina Entra ID ativo e clicavel
- Layout identico a secao "Insights de Seguranca"
- Cards de resumo no topo com metricas principais
- Insights agrupados por categoria (colapsaveis)
- Dialog de detalhes com lista de apps afetados
- Linguagem orientada a risco e decisao
- Destaques visuais para situacoes criticas

