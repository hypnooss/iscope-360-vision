
# Bug: Botao "Revalidar Permissoes" ausente em tenants pendentes

## Causa

No arquivo `src/pages/m365/TenantConnectionPage.tsx`, na secao "Aguardando Consentimento" (linha 438-448), o componente `TenantStatusCard` nao recebe a prop `onUpdatePermissions`. Apenas os tenants conectados (linha 418) recebem essa prop.

## Correcao

Adicionar `onUpdatePermissions={handleUpdatePermissions}` ao `TenantStatusCard` dentro do bloco de `pendingTenants` (linha 445).

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/m365/TenantConnectionPage.tsx` | Adicionar prop `onUpdatePermissions` no render dos pendingTenants |
