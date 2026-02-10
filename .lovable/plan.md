
# Remover Aba M365 e Criar Aba "Chaves de API"

## Resumo

Remover a aba "Microsoft 365" da pagina Configuracoes (ja que o conceito de tenant home foi descontinuado) e substituir por uma aba "Chaves de API" para gerenciar as API keys de terceiros usadas pelo sistema.

## Chaves de API identificadas no codigo

O sistema utiliza as seguintes API keys de terceiros (armazenadas como Supabase Secrets):

| Chave | Uso | Funcao |
|-------|-----|--------|
| `VIRUSTOTAL_API_KEY` | Enumeracao de subdomainios | `subdomain-enum` |
| `SECURITYTRAILS_API_KEY` | Enumeracao de subdomainios | `subdomain-enum` |

Essas chaves sao lidas via `Deno.env.get()` nas edge functions e configuradas como Supabase Secrets. A nova aba permitira visualizar se estao configuradas e atualizar seus valores.

## Impacto no backend (tenant home)

Tres edge functions referenciam `home_tenant_id`:
- `add-exchange-permission` - usa para obter token do tenant home
- `ensure-exchange-permission` - idem
- `agent-heartbeat` - ja migrou para usar `validation_tenant_id`

Como `home_tenant_id` e `validation_tenant_id` apontam para o mesmo tenant na pratica, as duas funcoes que ainda usam `home_tenant_id` serao atualizadas para usar `validation_tenant_id` em vez disso.

## Detalhes Tecnicos

### 1. Atualizar edge functions para usar `validation_tenant_id`

**`supabase/functions/add-exchange-permission/index.ts`:**
- Alterar select de `home_tenant_id` para `validation_tenant_id`
- Substituir todas as referencias a `home_tenant_id` por `validation_tenant_id`

**`supabase/functions/ensure-exchange-permission/index.ts`:**
- Mesma alteracao

### 2. Remover aba M365 e adicionar aba "Chaves de API" no SettingsPage

**`src/pages/admin/SettingsPage.tsx`:**

**Remover:**
- Todo o state relacionado a M365 (`m365Config`, `newAppId`, `newClientSecret`, `tenantIdForValidation`, `newAppObjectId`, `addingExchangePermission`, etc.)
- Funcoes `checkM365Config`, `validatePermissions`, `handleSaveM365Config`, `handleAddExchangePermission`
- Interface `M365Config`, `PermissionStatus`
- Arrays `defaultPermissions`, `corePermissions`, etc.
- `mergedPermissions` memo
- `TabsContent value="m365"` inteiro
- `TabsTrigger value="m365"`
- Import de `PasswordInput`
- Chamada `checkM365Config(true)` no useEffect
- Logica de autenticacao/retry do M365

**Adicionar:**
- Nova aba "Chaves de API" com icone `Key`
- Interface para gerenciar secrets de terceiros via uma edge function dedicada
- Para cada chave (VirusTotal, SecurityTrails): campo de input mascarado, status (configurada/nao), botao salvar
- Edge function `manage-api-keys` para ler status (configurada sim/nao) e atualizar valores das chaves

### 3. Criar edge function `manage-api-keys`

**`supabase/functions/manage-api-keys/index.ts`:**

- `GET`: Retorna lista de chaves conhecidas com status (configurada ou nao), sem revelar valores
- `POST`: Recebe `{ key_name, value }` e armazena na tabela `system_settings` (encriptado com AES-256-GCM usando `M365_ENCRYPTION_KEY`)

As edge functions de subdomain-enum ja leem via `Deno.env.get()`. Para manter compatibilidade, a nova funcao salvara na `system_settings` E a funcao `subdomain-enum` sera atualizada para verificar primeiro `system_settings` (decriptado) e depois fallback para `Deno.env.get()`.

### 4. Atualizar `subdomain-enum` para ler chaves do banco

**`supabase/functions/subdomain-enum/index.ts`:**
- No trecho que verifica `Deno.env.get(config.api_key_env)`, adicionar busca previa na tabela `system_settings` com a chave correspondente
- Se encontrar valor encriptado, decriptar e usar; senao, fallback para env var

### 5. Migracao SQL

- Remover coluna `home_tenant_id` da tabela `m365_global_config`

### 6. Remover `home_tenant_id` do frontend

- Remover envio de `home_tenant_id` em `handleSaveM365Config` (sera removido junto com toda a aba M365)
- Atualizar tipos em `src/integrations/supabase/types.ts` para remover `home_tenant_id`

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/admin/SettingsPage.tsx` | Remover aba M365, adicionar aba Chaves de API |
| `supabase/functions/add-exchange-permission/index.ts` | `home_tenant_id` -> `validation_tenant_id` |
| `supabase/functions/ensure-exchange-permission/index.ts` | `home_tenant_id` -> `validation_tenant_id` |
| `supabase/functions/manage-api-keys/index.ts` | Nova edge function |
| `supabase/functions/subdomain-enum/index.ts` | Ler API keys do banco com fallback para env |
| `src/integrations/supabase/types.ts` | Remover `home_tenant_id` |
| Migracao SQL | Remover coluna `home_tenant_id` |
