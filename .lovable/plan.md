

## Adicionar permissões faltantes e exibi-las no Tenant Edit

### Problema
Os endpoints de Intune (`/deviceManagement/*`), Security Alerts (`/security/alerts_v2`), Secure Score (`/security/secureScores`) e Teams (`/teamwork/teamSettings`) retornam 403 porque as permissões `DeviceManagementManagedDevices.Read.All`, `DeviceManagementConfiguration.Read.All`, `SecurityAlert.Read.All` e `SecurityEvents.Read.All` não estão no manifesto do App nem são validadas/exibidas. O endpoint `teams_settings` também usa um path inválido.

### Alterações

**1. `src/lib/m365PermissionDescriptions.ts` — Adicionar novas permissões**
Incluir descrições e adicionar ao array `GRAPH_PERMISSIONS`:
- `DeviceManagementManagedDevices.Read.All` — Leitura de dispositivos gerenciados (Intune)
- `DeviceManagementConfiguration.Read.All` — Leitura de políticas de dispositivos (Intune)
- `SecurityAlert.Read.All` — Leitura de alertas de segurança (Defender)
- `SecurityEvents.Read.All` — Leitura de eventos de segurança

Isso automaticamente faz com que apareçam na tela Ambiente > Tenant, pois a UI já itera sobre `GRAPH_PERMISSIONS`.

**2. `supabase/functions/ensure-exchange-permission/index.ts` — Adicionar ao manifesto**
Incluir os 4 novos GUIDs de permissão no array `REQUIRED_PERMISSIONS` para que sejam adicionados automaticamente ao manifesto do App Registration no Azure:
- `DeviceManagementManagedDevices.Read.All`: `e4c9e354-4dc5-45b8-9e7c-e1393b0b1a20`
- `DeviceManagementConfiguration.Read.All`: `dc377aa6-52d8-4e23-b271-b3b7f5e4f6c4`
- `SecurityAlert.Read.All`: `472e4a40-bb78-4d68-a2bb-8ac1c8de0c8c`
- `SecurityEvents.Read.All`: `bf394140-e372-4bf9-a898-299cfc7564e5`

**3. `supabase/functions/validate-m365-permissions/index.ts` — Validar as novas permissões**
Adicionar as 4 permissões ao array `RECOMMENDED_PERMISSIONS` para que sejam testadas durante a validação e o status salvo em `m365_tenant_permissions`.

**4. Migration SQL — Corrigir endpoint `teams_settings`**
Atualizar o blueprint de Teams para usar o endpoint correto `/teamwork/teamsAppSettings` (v1.0) em vez de `/teamwork/teamSettings` (beta).

**5. Inserir permissões na tabela `m365_required_permissions`**
Inserir as 4 novas permissões para que fiquem registradas na base.

### Arquivos a editar
1. `src/lib/m365PermissionDescriptions.ts` — 4 novas permissões + descrições
2. `supabase/functions/ensure-exchange-permission/index.ts` — 4 GUIDs no manifesto
3. `supabase/functions/validate-m365-permissions/index.ts` — 4 novas permissões na validação
4. Nova migration SQL — corrigir endpoint Teams + inserir permissões na tabela

