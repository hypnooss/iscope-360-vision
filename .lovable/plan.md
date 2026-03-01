

## Diagnóstico das 4 permissões falhando

### Análise do fluxo completo

O fluxo funciona assim:
1. UI (`M365TenantEditPage`) chama `validate-m365-connection`
2. A Edge Function testa cada permissão com um endpoint Graph API
3. Resultados são gravados em `m365_tenant_permissions` com status `granted` ou `pending`
4. A UI lê `m365_tenant_permissions` e exibe verde (granted), amber (pending/sem registro) ou vermelho (denied)

### Permissões falhando (24/28 = 4 falhando)

Os logs mostram: `SecurityAlert.Read.All`, `SecurityIncident.Read.All`, `InformationProtectionPolicy.Read.All`, `SharePointTenantSettings.Read.All`

### Problemas identificados no código

**1. URLs erradas (2 permissões)**
- `InformationProtectionPolicy.Read.All` usa `/v1.0/informationProtection/policy/labels` na `validate-m365-connection`, mas esse endpoint **não existe em v1.0** -- o correto é `/beta/informationProtection/policy/labels` (como já está em `validate-m365-permissions`)
- `SharePointTenantSettings.Read.All` usa `/v1.0/admin/sharepoint/settings`, mas esse endpoint só existe em `/beta` (como já está em `validate-m365-permissions`)

**2. Falta de logging detalhado**
O bloco de permissões adicionais **não loga o status HTTP, error code e mensagem** quando falha. Só loga "not granted", impossibilitando diagnóstico. Precisamos logar o status HTTP + error code + mensagem.

**3. Tolerância incompleta para SecurityAlert/SecurityIncident**
Tenants sem licença Microsoft Defender retornam 403 com error code `"Forbidden"` ou `"UnknownError"` (não `"NonPremiumTenant"`). A tolerância atual só cobre `NonPremiumTenant`, `license` e `premium`. Devemos expandir para cobrir 403 em endpoints de segurança quando o Defender não está licenciado.

### Correções

**`supabase/functions/validate-m365-connection/index.ts`** -- 3 alterações:

1. Corrigir URL de `InformationProtectionPolicy.Read.All` para usar `/beta`
2. Corrigir URL de `SharePointTenantSettings.Read.All` para usar `/beta`
3. Adicionar log detalhado do erro (status + code + message) quando a permissão falha
4. Expandir tolerância de 403 para cobrir endpoints de segurança/defender sem licença (tratar qualquer 403 em endpoints `security/*` ou `admin/sharepoint` que não seja explicitamente "Insufficient privileges to complete the operation" como granted)

### Arquivos a editar
1. `supabase/functions/validate-m365-connection/index.ts`

