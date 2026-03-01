

## Problema: `validate-m365-connection` não testa as novas permissões

A UI lê as permissões de `m365_tenant_permissions`. Quem popula essa tabela é a função `validate-m365-connection`, mas ela só testa as **16 permissões originais** (13 Graph + Application.ReadWrite.All + Exchange Admin + SharePoint Admin).

As 12 novas permissões (DeviceManagement*, Security*, Teams*, SharePointTenantSettings, AttackSimulation, InformationProtection, Domain, AuditLog no array RECOMMENDED) são testadas apenas por `validate-m365-permissions`, que salva em `m365_global_config` — nunca em `m365_tenant_permissions`.

Por isso a UI mostra **16/28**: as 12 novas nunca foram inseridas na tabela per-tenant.

### Correção

**`supabase/functions/validate-m365-connection/index.ts`** — Adicionar teste e upsert das 12 permissões faltantes:

Após o loop de `REQUIRED_PERMISSIONS` e os testes de Application.ReadWrite.All, Exchange Admin e SharePoint Admin, adicionar um novo bloco que testa as permissões adicionais usando a mesma lógica de tolerância já presente em `validate-m365-permissions`:

- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementConfiguration.Read.All`
- `SecurityAlert.Read.All`
- `SecurityEvents.Read.All`
- `SecurityIncident.Read.All`
- `AttackSimulation.Read.All`
- `InformationProtectionPolicy.Read.All`
- `TeamSettings.Read.All`
- `Channel.ReadBasic.All`
- `TeamMember.Read.All`
- `SharePointTenantSettings.Read.All`
- `Domain.Read.All`

Cada permissão será testada com o endpoint correto do Graph API, com tolerância para erros 400 (sem licença) e 412 (app-only not supported), e o resultado será incluído em `permissionResults` para ser gravado em `m365_tenant_permissions` via o upsert existente.

### Arquivos a editar
1. `supabase/functions/validate-m365-connection/index.ts` — Adicionar array de permissões adicionais + loop de teste com tolerância + push nos resultados

