

## Plano: Automatizar propagação de permissões do banco para todas as Edge Functions

### Problema

As funções `validate-m365-permissions` e `validate-m365-connection` usam listas de permissões **hardcoded**. Quando uma nova permissão é adicionada pela UI (tabela `m365_required_permissions`), ela só é propagada para `ensure-exchange-permission` (que já lê do banco), mas as duas funções de validação continuam ignorando-a.

### Solução

1. **Adicionar coluna `test_url`** à tabela `m365_required_permissions` para que cada permissão tenha a URL de teste do Graph API associada. Isso permite que as edge functions testem permissões dinamicamente sem hardcode.

2. **Atualizar `validate-m365-connection`** para ler permissões do banco:
   - Buscar todas as permissões de `m365_required_permissions` com `test_url`
   - Manter handlers especializados em código apenas para permissões complexas (`MailboxSettings.Read`, `Mail.Read`, `Application.ReadWrite.All`, `Channel.ReadBasic.All`, `TeamMember.Read.All`) que requerem lógica multi-step
   - Para todas as demais, usar a `test_url` do banco com a mesma lógica de tolerância já existente
   - Remover as listas `REQUIRED_PERMISSIONS` e `ADDITIONAL_PERMISSIONS` hardcoded

3. **Atualizar `validate-m365-permissions`** para ler permissões do banco:
   - Buscar todas as permissões de `m365_required_permissions`
   - Manter a função `testPermission` com switch/case para handlers complexos
   - Adicionar `default` case que usa `test_url` do banco para permissões novas
   - Remover os arrays `REQUIRED_PERMISSIONS`, `RECOMMENDED_PERMISSIONS` e `CERTIFICATE_PERMISSIONS` hardcoded

4. **Atualizar a UI de gerenciamento** (`M365PermissionsManagement.tsx`) para incluir campo `test_url` no formulário de adição, com placeholder explicativo (ex: `https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/healthOverviews?$top=1`)

5. **Popular `test_url`** nas permissões existentes via migration de dados

### Migração SQL

```sql
ALTER TABLE m365_required_permissions ADD COLUMN test_url text;

-- Popular test_url para todas as permissões existentes
UPDATE m365_required_permissions SET test_url = CASE permission_name
  WHEN 'User.Read.All' THEN 'https://graph.microsoft.com/v1.0/users?$top=1&$select=id'
  WHEN 'Directory.Read.All' THEN 'https://graph.microsoft.com/v1.0/domains?$top=1'
  WHEN 'Group.Read.All' THEN 'https://graph.microsoft.com/v1.0/groups?$top=1&$select=id'
  -- ... (todas as 30+ permissões)
  WHEN 'ServiceHealth.Read.All' THEN 'https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/healthOverviews?$top=1'
END;
```

### Arquivos

1. **Migração SQL** — adicionar coluna `test_url` + popular dados
2. `supabase/functions/validate-m365-connection/index.ts` — ler permissões do banco
3. `supabase/functions/validate-m365-permissions/index.ts` — ler permissões do banco
4. `src/components/admin/M365PermissionsManagement.tsx` — campo `test_url` no formulário

### Resultado

Ao adicionar uma nova permissão pela UI com nome e `test_url`, as três edge functions (`ensure-exchange-permission`, `validate-m365-permissions`, `validate-m365-connection`) passam automaticamente a incluí-la sem necessidade de alteração de código.

