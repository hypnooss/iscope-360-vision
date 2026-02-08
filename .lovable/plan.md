
# Plano: Adicionar RoleManagement.ReadWrite.Directory em Todo o Fluxo M365

## Contexto

A permissão `RoleManagement.ReadWrite.Directory` é necessária para que o sistema possa automaticamente atribuir a role **Exchange Administrator** ao Service Principal do App no tenant cliente. Esta role é obrigatória para que o PowerShell possa conectar ao Exchange Online via CBA (Certificate-Based Authentication).

Atualmente, as permissões são definidas em múltiplos locais (edge functions, migrations, frontend) e precisamos adicionar `RoleManagement.ReadWrite.Directory` em todos eles.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/m365-oauth-callback/index.ts` | Adicionar à lista REQUIRED_PERMISSIONS |
| `supabase/functions/validate-m365-permissions/index.ts` | Adicionar à lista RECOMMENDED_PERMISSIONS e criar teste |
| `supabase/functions/validate-m365-connection/index.ts` | Adicionar à lista REQUIRED_PERMISSIONS e criar teste |
| `supabase/functions/get-m365-config/index.ts` | Adicionar à lista REQUIRED_PERMISSIONS |
| `src/pages/admin/SettingsPage.tsx` | Adicionar à lista defaultPermissions |
| Migração SQL | Inserir nova permissão na tabela m365_required_permissions |

---

## Mudanças Detalhadas

### 1. `m365-oauth-callback/index.ts`

Adicionar `RoleManagement.ReadWrite.Directory` à lista de permissões requeridas e criar teste:

**Linha 15-25 (REQUIRED_PERMISSIONS)**:
```typescript
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'Policy.Read.All',
  'RoleManagement.ReadWrite.Directory', // NOVO - Para atribuir Exchange Admin Role
  // Exchange Online
  'MailboxSettings.Read',
  'Mail.Read',
];
```

**Adicionar teste de permissão** (na seção de permission tests):
```typescript
// Test RoleManagement.ReadWrite.Directory
{ 
  permission: 'RoleManagement.ReadWrite.Directory', 
  endpoint: 'https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions?$top=1' 
},
```

### 2. `validate-m365-permissions/index.ts`

Mover de RECOMMENDED para REQUIRED e adicionar teste:

**Linhas 15-30**:
```typescript
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All',
  'Organization.Read.All',
  'Domain.Read.All',
  'RoleManagement.ReadWrite.Directory', // NOVO
];

const RECOMMENDED_PERMISSIONS = [
  'Group.Read.All',
  'Application.Read.All',
  'Policy.Read.All',
  'RoleManagement.Read.Directory', // Manter para leitura
  // Exchange Online
  'MailboxSettings.Read',
  'Mail.Read',
];
```

**Adicionar case no testPermission (linha ~175)**:
```typescript
case 'RoleManagement.ReadWrite.Directory':
  url = 'https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions?$top=1&$select=id';
  break;
```

### 3. `validate-m365-connection/index.ts`

Adicionar à lista e criar teste:

**Linhas 22-32**:
```typescript
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All', 
  'Group.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'RoleManagement.ReadWrite.Directory', // NOVO
  // Exchange Online
  'MailboxSettings.Read',
  'Mail.Read',
];
```

**Adicionar teste (após linha ~376)**:
```typescript
} else if (permission === 'RoleManagement.ReadWrite.Directory') {
  // Test ability to read/write directory role assignments
  const response = await fetch('https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions?$top=1&$select=id', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  granted = response.ok;
  console.log(`Permission ${permission}: ${response.status} - granted: ${granted}`);
}
```

### 4. `get-m365-config/index.ts`

Adicionar à lista de permissões:

**Linhas 8-14 (REQUIRED_PERMISSIONS)**:
```typescript
const REQUIRED_PERMISSIONS = [
  'User.Read.All',
  'Directory.Read.All',
  'Organization.Read.All',
  'Domain.Read.All',
  'RoleManagement.ReadWrite.Directory', // NOVO
];
```

**Adicionar case no testPermission (linha ~127)**:
```typescript
case 'RoleManagement.ReadWrite.Directory':
  url = 'https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions?$top=1&$select=id';
  break;
```

### 5. `src/pages/admin/SettingsPage.tsx`

Adicionar à lista de permissões padrão do frontend:

**Linhas 83-100 (defaultPermissions)**:
```typescript
const defaultPermissions: PermissionStatus[] = [
  // Core permissions
  { name: 'User.Read.All', granted: false, type: 'required' },
  { name: 'Directory.Read.All', granted: false, type: 'required' },
  { name: 'Organization.Read.All', granted: false, type: 'required' },
  { name: 'Domain.Read.All', granted: false, type: 'required' },
  { name: 'RoleManagement.ReadWrite.Directory', granted: false, type: 'required' }, // NOVO
  // Entra ID / Security
  { name: 'Group.Read.All', granted: false, type: 'recommended' },
  { name: 'Application.Read.All', granted: false, type: 'recommended' },
  { name: 'Policy.Read.All', granted: false, type: 'recommended' },
  { name: 'Reports.Read.All', granted: false, type: 'recommended' },
  { name: 'RoleManagement.Read.Directory', granted: false, type: 'recommended' },
  // Exchange Online
  { name: 'MailboxSettings.Read', granted: false, type: 'recommended' },
  { name: 'Mail.Read', granted: false, type: 'recommended' },
  // Certificate Upload
  { name: 'Application.ReadWrite.All', granted: false, type: 'recommended' },
];
```

**Atualizar corePermissions (linha ~103)**:
```typescript
const corePermissions = ['User.Read.All', 'Directory.Read.All', 'Organization.Read.All', 'Domain.Read.All', 'RoleManagement.ReadWrite.Directory'];
```

### 6. Migração SQL

Criar nova migração para inserir a permissão na tabela `m365_required_permissions`:

```sql
-- Add RoleManagement.ReadWrite.Directory permission for Exchange Administrator role assignment
INSERT INTO public.m365_required_permissions (submodule, permission_name, permission_type, description, is_required)
VALUES (
  'entra_id', 
  'RoleManagement.ReadWrite.Directory', 
  'Application', 
  'Atribuir roles de diretório (Exchange Administrator) ao Service Principal', 
  true
)
ON CONFLICT (permission_name, submodule) DO UPDATE SET
  description = EXCLUDED.description,
  is_required = EXCLUDED.is_required;
```

---

## Fluxo Atualizado

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  FLUXO DE PERMISSÕES M365 - ATUALIZADO                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Tenant Home (MSP)                                                       │
│     └─ App Registration configura permissões:                              │
│        • User.Read.All                                                      │
│        • Directory.Read.All                                                 │
│        • RoleManagement.ReadWrite.Directory  (NOVO)                        │
│        • ... outras permissões                                             │
│                                                                             │
│  2. Tenant Cliente (via Admin Consent)                                      │
│     └─ Admin concede permissões listadas acima                             │
│     └─ m365-oauth-callback:                                                │
│        a) Valida permissões Graph API                                       │
│        b) Atribui Exchange Administrator Role automaticamente              │
│        c) Salva status em m365_tenant_permissions                          │
│                                                                             │
│  3. Validação Periódica                                                     │
│     └─ validate-m365-permissions verifica todas as permissões              │
│     └─ Exibe status no TenantStatusCard                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Ação Manual Requerida no Azure

Após implementar as mudanças de código, o App Registration no Azure precisa ser atualizado:

1. Acesse o Azure Portal do tenant MSP (home)
2. Vá em **Microsoft Entra ID** > **App registrations** > Selecione o App multi-tenant
3. Vá em **API Permissions** > **Add a permission**
4. Selecione **Microsoft Graph** > **Application permissions**
5. Busque e adicione **RoleManagement.ReadWrite.Directory**
6. Clique em **Grant admin consent for [Tenant]** (para o tenant home)

Os tenants clientes precisarão reconsentir para obter a nova permissão (botão "Permissões" no card do tenant).

---

## Benefícios

1. **Automação completa**: Exchange Administrator Role será atribuída automaticamente durante o consentimento
2. **Consistência**: Permissão presente em todos os locais do fluxo (edge functions, DB, frontend)
3. **Visibilidade**: Status da permissão aparece na lista de permissões do tenant
4. **Graceful degradation**: Se a permissão não for concedida, o sistema continua funcionando com outras features

---

## Resumo Técnico de Arquivos

| Arquivo | Tipo | Propósito |
|---------|------|-----------|
| `m365-oauth-callback` | Edge Function | Valida permissões e atribui role após consentimento |
| `validate-m365-permissions` | Edge Function | Validação periódica e exibição de status |
| `validate-m365-connection` | Edge Function | Teste de conexão com tenant |
| `get-m365-config` | Edge Function | Retorna config e status de permissões |
| `SettingsPage.tsx` | Frontend | Exibe lista de permissões na configuração global |
| Migração SQL | Database | Define permissões requeridas por submódulo |
