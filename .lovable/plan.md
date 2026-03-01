

## Diagnóstico e Correções na Validação de Permissões M365

### Diagnóstico do Tenant TASCHIBRA

Os logs mostram 3 categorias de falhas:

**1. Admin Consent NÃO concedido (real)** — 5 permissões:
- `SecurityAlert.Read.All`, `SecurityEvents.Read.All`, `SecurityIncident.Read.All`, `TeamMember.Read.All`, `SharePointTenantSettings.Read.All`
- Estas retornam 403 com "Missing application roles" — o tenant precisa re-consentir

**2. Sem licença no tenant (falso negativo — bug nosso)** — 3 permissões:
- `DeviceManagementManagedDevices.Read.All` e `DeviceManagementConfiguration.Read.All` → 400 "Request not applicable to target tenant" (sem Intune)
- `InformationProtectionPolicy.Read.All` → 400 "service principal disabled" (sem MIP/Purview)
- **O consent PODE estar correto**, mas como o serviço não existe no tenant, o teste falha. Devemos tratar como "granted"

**3. Endpoints de teste com bugs** — 3 permissões:
- `TeamSettings.Read.All` → 412 "not supported in application-only context" — o endpoint `/teamwork/teamsAppSettings` não funciona com tokens app-only
- `Channel.ReadBasic.All` → 400 "$top not allowed" no endpoint de channels
- `Application.ReadWrite.All` → 404 porque usa o `app_object_id` do HOME tenant, mas o Graph API precisa do object ID no TENANT DO CLIENTE

### Alterações necessárias

**`supabase/functions/validate-m365-permissions/index.ts`:**

1. **Tratar erros de licença como "granted"**: Na função `testPermission`, quando o status for 400 e a mensagem contiver "not applicable to target tenant" ou "service principal for resource.*is disabled", retornar `true` (a permissão existe, o serviço é que não está disponível)

2. **Corrigir endpoint `TeamSettings.Read.All`**: Trocar `/teamwork/teamsAppSettings` por `/teams?$top=1&$select=id` (usa `Group.Read.All` que já funciona, ou simplesmente testar via groups filter como já fazemos para Channel/TeamMember)

3. **Corrigir endpoint `Channel.ReadBasic.All`**: Remover `$top=1` da query de channels — usar `/teams/{id}/channels?$select=id` sem paginação

4. **Corrigir `Application.ReadWrite.All`**: Em vez de usar o `appObjectId` passado (que é do HOME tenant), fazer auto-discovery do object ID no tenant do cliente via `GET /applications(appId='{appId}')?$select=id,keyCredentials`

### Arquivos a editar
1. `supabase/functions/validate-m365-permissions/index.ts` — 4 correções nos endpoints de teste + tolerância a erros de licença

### Ação manual necessária
Após o deploy das correções, o Admin Consent precisa ser re-disparado no tenant TASCHIBRA para as 5 permissões genuinamente faltantes. Isso é feito automaticamente pelo fluxo "Revalidar Permissões" da UI.

