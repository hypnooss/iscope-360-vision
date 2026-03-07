

## Plano: Seção M365 Permissions no Settings + Correção da Propagação Lenta

### Problemas

1. **Propagação lenta**: O polling faz 9 tentativas × 20s = 3 minutos de espera, e cada chamada `validate-m365-connection` faz 30+ requests HTTP sequenciais + sleep de 15s interno. O Edge Function pode estourar o timeout.
2. **Sem UI de gerenciamento**: A tabela `m365_required_permissions` já existe no banco com 14 permissões, mas faltam 17 que estão hardcoded nas edge functions. Não existe UI para gerenciar essas permissões.

### Alterações

**1. Migração SQL - Sincronizar permissões faltantes**

Inserir as permissões que existem no hardcode mas faltam na tabela `m365_required_permissions`:
- `User.Read.All`, `Directory.Read.All`, `Group.Read.All`, `Application.Read.All`, `Organization.Read.All`, `Policy.Read.All`, `IdentityRiskyUser.Read.All`, `IdentityRiskEvent.Read.All`, `MailboxSettings.Read`, `Mail.Read`, `Sites.Read.All`, `Reports.Read.All`, `ServiceHealth.Read.All`, `Application.ReadWrite.All`

Adicionar RLS policy para super_admin poder INSERT/UPDATE/DELETE.

**2. Nova tab "Microsoft 365" no `SettingsPage.tsx`**

- Adicionar tab com icone `Shield` e label "Microsoft 365"
- Listar todas as permissões da tabela `m365_required_permissions` agrupadas por `submodule`
- Para cada permissão: nome, descrição, tipo, obrigatória (switch), botão excluir
- Formulário para adicionar nova permissão: `permission_name`, `submodule` (select), `description`, `is_required` (switch)
- Botão "Atualizar Manifesto" que chama `ensure-exchange-permission` para sincronizar o App Registration no Azure

**3. Otimizar polling de propagação (`M365TenantEditPage.tsx`)**

- Reduzir `MAX_ATTEMPTS` de 9 para 5
- Reduzir `INTERVAL_MS` de 20000 para 10000 (10s)
- Total: 50s em vez de 3 minutos
- Adicionar botão "Cancelar" durante o polling para interromper manualmente

**4. Edge function `ensure-exchange-permission` - Ler do banco**

- Em vez de usar lista `REQUIRED_PERMISSIONS` hardcoded, ler da tabela `m365_required_permissions`
- Mapear `permission_name` para os GUIDs do Graph API (manter mapa de IDs no código, pois os GUIDs são fixos da Microsoft)
- Assim, ao adicionar uma permissão na UI, ela automaticamente entra no manifesto na próxima execução

### Arquivos

1. **Migração SQL** - inserir permissões faltantes + RLS para CRUD
2. `src/pages/admin/SettingsPage.tsx` - nova tab "Microsoft 365" com CRUD de permissões
3. `src/pages/environment/M365TenantEditPage.tsx` - otimizar polling (5×10s) + botão cancelar
4. `supabase/functions/ensure-exchange-permission/index.ts` - ler permissões do banco

