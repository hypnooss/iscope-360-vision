

## Permissões completas e ajustes de Blueprint para M365 Compliance robusto

### Análise do estado atual

**Blueprints existentes:** Entra ID, Exchange Online (hybrid), Intune & Defender, SharePoint & OneDrive, Teams — 5 blueprints.

**Permissões atuais (18 Graph + 2 Directory Roles):** User.Read.All, Directory.Read.All, Group.Read.All, Application.Read.All, AuditLog.Read.All, Organization.Read.All, Policy.Read.All, IdentityRiskyUser.Read.All, MailboxSettings.Read, Mail.Read, RoleManagement.ReadWrite.Directory, Sites.Read.All, Application.ReadWrite.All, Reports.Read.All, DeviceManagementManagedDevices.Read.All, DeviceManagementConfiguration.Read.All, SecurityAlert.Read.All, SecurityEvents.Read.All + Exchange Administrator, SharePoint Administrator.

### Permissões faltantes a adicionar

| Permissão | Produto | Justificativa | GUID (Microsoft Graph) |
|---|---|---|---|
| `AuditLog.Read.All` | Entra ID | Sign-in logs, directory audits | `b0afded3-3588-46d8-8b3d-9842eff778da` |
| `SecurityIncident.Read.All` | Defender | Incidentes de segurança (DEF-002) | `45cc0394-e837-488b-a098-1c7ce2c0e0b5` |
| `InformationProtectionPolicy.Read.All` | Purview/MIP | Labels de proteção (DEF-005) | `19da66cb-0fb0-49a4-b7a2-3607ae4e9acf` |
| `AttackSimulation.Read.All` | Defender | Simulações de phishing (DEF-003) | `93283d0a-6322-4fa8-966b-813c78c0e1b4` |
| `TeamSettings.Read.All` | Teams | Configurações de Teams | `242607bd-1d2c-432c-82eb-bdb27baa23ab` |
| `Channel.ReadBasic.All` | Teams | Canais privados (TMS-004) | `59a6b24b-4225-4393-a6be-42ed3eab75c4` |
| `TeamMember.Read.All` | Teams | Membros e guests em Teams (TMS-001) | `660b7406-55f1-41ca-a0ed-0b035e182f3e` |
| `SharePointTenantSettings.Read.All` | SharePoint | Configurações do admin SharePoint | `83d4163d-a2d8-4e3b-b3a5-5d4b1a5e5f6e` |
| `Domain.Read.All` | Entra ID | Domínios verificados (já validado mas não listado no catálogo UI) | Já incluído na validação |

**Nota:** `AuditLog.Read.All` já está no `GRAPH_PERMISSIONS` e `PERMISSION_DESCRIPTIONS`, mas **não está** no `REQUIRED_PERMISSIONS` do manifesto nem no `RECOMMENDED_PERMISSIONS` da validação — precisa ser adicionado.

### Ajustes nos Blueprints

**1. M365 - Intune & Defender** — Adicionar steps para regras sem `source_key`:
- `security_incidents` → `/security/incidents?$top=50` (DEF-002)
- `attack_simulation` → `/security/attackSimulation/simulations?$top=50` (DEF-003)
- `information_protection_labels` → `/informationProtection/policy/labels` (DEF-005)

**2. M365 - SharePoint & OneDrive** — Adicionar steps:
- `sharepoint_sharing_links` → `/sites/{siteId}/permissions` ou endpoint alternativo para SPO-002/SPO-004

**3. M365 - Teams** — Adicionar steps:
- `teams_members` → Para cada team, `/teams/{id}/members` (amostra de 20 teams) — necessário para TMS-001
- `teams_channels` → `/teams/{id}/channels` para detectar canais privados (TMS-004)
- Corrigir endpoint `teams_settings`: `/teamwork/teamsAppSettings` (já corrigido na migration anterior, confirmar)

**4. Compliance Rules com `source_key: nil`** — Atualizar as regras DEF-001 a DEF-005, INT-001 a INT-006, PIM-001 a PIM-004, SPO-001 a SPO-004, TMS-001 a TMS-004, THR-001 a THR-005 para terem `source_key` e `evaluation_logic` corretos apontando para os steps dos blueprints.

### Arquivos a editar

1. **`src/lib/m365PermissionDescriptions.ts`** — Adicionar ~7 novas permissões ao catálogo e ao array `GRAPH_PERMISSIONS`
2. **`supabase/functions/ensure-exchange-permission/index.ts`** — Adicionar GUIDs das novas permissões ao manifesto
3. **`supabase/functions/validate-m365-permissions/index.ts`** — Adicionar novas permissões ao `RECOMMENDED_PERMISSIONS` + test endpoints
4. **Migration SQL** — Atualizar blueprints (Intune & Defender, SharePoint, Teams) com novos steps + atualizar `source_key` e `evaluation_logic` das ~30 compliance rules com `source_key: nil` + inserir novas permissões na tabela `m365_required_permissions`
5. **`supabase/functions/m365-security-posture/index.ts`** — Adicionar lógicas de avaliação para os novos `evaluate.type` das regras atualizadas (ex: `check_device_compliance`, `check_security_incidents`, `check_teams_visibility`, etc.)

### Escopo e impacto

- **~7 novas permissões** no manifesto e validação
- **~10 novos steps** nos blueprints existentes
- **~30 compliance rules** atualizadas com `source_key` e lógica de avaliação
- **1 revalidação de permissões** no tenant resolve tudo
- Após deploy, re-executar análise de Postura para popular os novos dados

