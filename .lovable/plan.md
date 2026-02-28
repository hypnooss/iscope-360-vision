

## Corrigir "Revalidar Permissoes" para abrir Admin Consent do Azure

### Problema

O botao "Revalidar Permissoes" na pagina de edicao do tenant (`M365TenantEditPage`) apenas chama a edge function `validate-m365-permissions` que **testa** as permissoes no servidor usando `client_credentials`. Quando uma permissao esta faltando (como `IdentityRiskyUser.Read.All`), ele apenas reporta que falhou, mas nao abre a tela de login do Azure para o administrador conceder a permissao.

O wizard de conexao inicial (`TenantConnectionWizard`) ja tem esse fluxo implementado: ele abre um popup com a URL `https://login.microsoftonline.com/{tenant_id}/adminconsent` e escuta a resposta via `postMessage`.

### Solucao

Alterar o fluxo de "Revalidar Permissoes" para:

1. Primeiro, chamar `validate-m365-permissions` para verificar quais permissoes estao pendentes
2. Se houver permissoes pendentes, abrir o popup de Admin Consent do Azure (mesmo padrao do wizard)
3. Escutar a resposta via `postMessage` do popup (usando `OAuthCallbackPage`)
4. Apos o retorno do popup, revalidar as permissoes automaticamente

### Mudancas

**Arquivo: `src/pages/environment/M365TenantEditPage.tsx`**

- Adicionar estado para controlar o fluxo de re-consent (`waitingForConsent`)
- Modificar `handleRevalidatePermissions`:
  - Chamar `validate-m365-permissions` primeiro
  - Se houver `failedRequired > 0` ou `failedRecommended > 0`, buscar o `app_id` via `get-m365-config`
  - Construir a URL de Admin Consent: `https://login.microsoftonline.com/{tenant.tenant_id}/adminconsent`
  - Abrir popup com a mesma mecanica do `TenantConnectionWizard`
  - Construir o `state` payload com `tenant_record_id`, `client_id`, `tenant_id` e `redirect_url`
- Adicionar `useEffect` para escutar `postMessage` do popup (tipo `m365-oauth-callback`)
- Apos retorno do popup, chamar `validate-m365-permissions` novamente para atualizar o status das permissoes
- Se todas as permissoes ja estiverem concedidas, mostrar toast de sucesso sem abrir popup

### Fluxo do usuario

1. Usuario clica "Revalidar Permissoes"
2. Sistema verifica permissoes no servidor
3. Se ha permissoes faltando: abre popup do Azure para admin conceder
4. Admin faz login e concede as permissoes
5. Popup redireciona para callback, que envia `postMessage`
6. Sistema revalida automaticamente e atualiza a lista de permissoes
7. Se todas ja estao OK: mostra toast "Todas as permissoes ja estao concedidas"

