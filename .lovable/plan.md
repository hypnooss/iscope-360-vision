# Plano: Validação de Permissões M365

## Status: ✅ Implementado

As alterações foram aplicadas para sincronizar a validação de permissões entre UI e Backend.

### Alterações Realizadas

1. **Edge Function `validate-m365-connection`**:
   - Adicionadas 4 novas permissões Graph API: `Organization.Read.All`, `Policy.Read.All`, `Sites.Read.All`, `Reports.Read.All`
   - Adicionada validação para `Application.ReadWrite.All` (usando app_object_id)
   - Adicionada validação para `SharePoint Administrator` directory role
   - Refatorada função genérica `testDirectoryRole()` para testar qualquer directory role
   - Removida função duplicada `testExchangeAdminRole()` 

2. **UI `TenantStatusCard.tsx`**:
   - Removida permissão `User.Read` (é delegated, não application)
   - Mantidas 15 permissões + 2 directory roles = 17 itens total
