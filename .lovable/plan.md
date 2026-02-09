
# Chamar ensure-exchange-permission antes do Admin Consent inicial

## Problema

Quando um tenant novo e conectado, o fluxo de Admin Consent nao inclui a chamada a `ensure-exchange-permission`. Isso significa que as permissoes `Exchange.ManageAsApp` e `Sites.FullControl.All` podem nao estar no `requiredResourceAccess` do App Registration no momento do consentimento. O Admin Consent so concede permissoes que ja estao listadas no App Registration -- resultado: a primeira analise Exchange falha com o erro "The role assigned to application isn't supported".

Ao clicar em "Revalidar Permissoes", o sistema chama `ensure-exchange-permission` (que adiciona as permissoes ao App Registration) e depois abre o Admin Consent novamente, resolvendo o problema.

## Solucao

Adicionar a mesma chamada `ensure-exchange-permission` que ja existe em `handleUpdatePermissions` nos dois wizards de conexao de tenant, antes de abrir a janela de Admin Consent.

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/m365/SimpleTenantConnectionWizard.tsx` | Chamar `ensure-exchange-permission` antes de abrir Admin Consent (linha ~375) |
| `src/components/m365/TenantConnectionWizard.tsx` | Mesma chamada antes de abrir Admin Consent (linha ~377) |

## Detalhes tecnicos

Em ambos os arquivos, antes de construir a URL de Admin Consent, inserir:

```typescript
// Ensure Exchange.ManageAsApp and Sites.FullControl.All are in App Registration
const { error: ensureError } = await supabase.functions.invoke('ensure-exchange-permission');
if (ensureError) {
  console.warn('Could not ensure Exchange permission:', ensureError);
  // Non-blocking - continue with consent
}
```

A chamada e nao-bloqueante: se falhar, o consentimento continua normalmente (mesmo comportamento de `handleUpdatePermissions`). Na maioria dos casos, essa chamada e rapida e garante que as permissoes Exchange/SharePoint estejam prontas quando o admin aceitar o consent.
