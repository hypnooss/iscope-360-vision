

## Correções: Saúde do Microsoft 365

### Problemas Identificados

1. **Espaçamento**: A página não usa `p-6 lg:p-8` no container principal, diferente do padrão das outras páginas M365.
2. **Workspace Selector ausente**: Para super_admin, não aparece o seletor de Workspace, então o `useM365TenantSelector` recebe um `selectedWorkspaceId` que pode não corresponder a todos os tenants disponíveis — limitando a visibilidade.
3. **API retornando 0 dados**: Os logs da edge function mostram `UnknownError` da Graph API. A causa é que a função usa **apenas** as credenciais globais (`m365_global_config`), sem tentar primeiro as credenciais per-tenant (`m365_app_credentials`). O Analyzer usa uma estratégia dupla (`getGraphToken`) que tenta per-tenant primeiro e depois global — e funciona. A service-health precisa replicar essa lógica.

### Alterações

**1. `src/pages/m365/M365ServiceHealthPage.tsx`**

- Adicionar `p-6 lg:p-8` ao container principal (linha ~183) para alinhar com padrão das demais páginas.
- Adicionar **Workspace Selector** (componente `Select`) para perfis `super_admin`/`super_suporte`, idêntico ao padrão do `M365PosturePage` (linhas 411-422). Expor `setSelectedWorkspaceId` do hook.

**2. `supabase/functions/m365-service-health/index.ts`**

- Replicar a estratégia de autenticação do Analyzer:
  1. Tentar credenciais per-tenant (`m365_app_credentials` com `is_active=true`)
  2. Fallback para credenciais globais (`m365_global_config`)
- Adicionar função `decryptSecret` e `requestGraphToken` auxiliares (mesma lógica do analyzer)
- Remover a lógica atual inline de decrypt + token que só consulta `m365_global_config`

### Arquivos

1. `src/pages/m365/M365ServiceHealthPage.tsx` — padding + workspace selector
2. `supabase/functions/m365-service-health/index.ts` — autenticação per-tenant + fallback global

