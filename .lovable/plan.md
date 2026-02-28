

## Análise: Remoção segura da tela "Tenants" do módulo M365

### Referências encontradas a `/scope-m365/tenant-connection`

A rota é referenciada em **14 arquivos**. Remover é viável, mas exige atualizar todas as referências.

| Local | Uso atual | Ação |
|---|---|---|
| `AppLayout.tsx` | Menu "Tenants" no sidebar M365 | Remover item do menu |
| `App.tsx` | Rota + 3 redirects (`/scope-m365`, `/dashboard`, `/analysis`) | Remover rota; redirects apontam para `/scope-m365/posture` |
| `TenantConnectionPage.tsx` | A página em si | Pode ser removida (500 linhas) |
| `OAuthCallbackPage.tsx` | Fallback redirect após OAuth | Redirecionar para `/environment` |
| `AddM365TenantPage.tsx` | `redirect_url` no OAuth state + `handleFinish` | `redirect_url` continua igual (é usado pelo backend); `handleFinish` redireciona para `/environment` |
| `SimpleTenantConnectionWizard.tsx` | `redirect_url` no OAuth state | Manter (usado pelo backend callback) |
| 6 páginas M365 (Posture, EntraId, Exchange, CVEs, etc.) | Links "Conectar Tenant" no empty state | Apontar para `/environment/new/m365` |
| Breadcrumbs em páginas M365 | `href: '/scope-m365/tenant-connection'` | Apontar para `/scope-m365/posture` (ou `/environment`) |

### Plano de implementação

**1. `src/components/layout/AppLayout.tsx`**
- Remover o item `{ label: 'Tenants', href: '/scope-m365/tenant-connection' }` do menu M365.

**2. `src/App.tsx`**
- Remover rota `/scope-m365/tenant-connection`.
- Remover import `TenantConnectionPage`.
- Alterar redirects de `/scope-m365`, `/scope-m365/dashboard`, `/scope-m365/analysis` para apontar a `/scope-m365/posture`.

**3. Atualizar empty states (6 páginas M365)**
- Em `EntraIdPage`, `EntraIdAnalysisPage`, `EntraIdSecurityInsightsPage`, `EntraIdApplicationInsightsPage`, `ExchangeOnlinePage`, `M365PosturePage`: trocar link "Conectar Tenant" de `/scope-m365/tenant-connection` para `/environment/new/m365`.

**4. Breadcrumbs M365**
- `M365CVEsPage.tsx`, e outras páginas: trocar href do breadcrumb de `/scope-m365/tenant-connection` para `/scope-m365/posture`.

**5. `OAuthCallbackPage.tsx`**
- Trocar fallback redirect para `/environment`.

**6. `AddM365TenantPage.tsx`**
- `handleFinish`: redirecionar para `/environment` em vez de `/scope-m365/tenant-connection`.
- Manter `redirect_url` no OAuth state (o backend precisa dessa URL para o callback).

**7. Arquivos que podem ser removidos depois** (não obrigatório agora)
- `src/pages/m365/TenantConnectionPage.tsx`
- `src/components/m365/TenantStatusCard.tsx` (se não for usado em outro lugar)
- `src/components/m365/SimpleTenantConnectionWizard.tsx` (se não for usado em outro lugar)

### Nota sobre `redirect_url` no OAuth

O `redirect_url` enviado ao backend (`/scope-m365/tenant-connection`) é usado pelo fluxo OAuth para retornar ao app. Porém, o retorno real passa pelo `OAuthCallbackPage` (`/scope-m365/oauth-callback`), então a `redirect_url` no state pode ser atualizada para `/environment` sem impacto.

