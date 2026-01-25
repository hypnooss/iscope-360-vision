# Guia de Migração - InfraScope360

## Visão Geral

Este guia detalha o processo de migração do banco de dados do Lovable Cloud para um projeto Supabase próprio.

---

## Pré-Requisitos

### 1. Criar Projeto no Supabase

1. Acesse [supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em "New Project"
3. Configure:
   - **Name**: InfraScope360 (ou nome de sua preferência)
   - **Database Password**: Anote essa senha!
   - **Region**: Escolha a mais próxima (ex: São Paulo)
4. Aguarde a criação (~2 minutos)

### 2. Obter Credenciais

No dashboard do novo projeto, navegue para **Settings > API** e anote:

| Credencial | Onde Usar |
|------------|-----------|
| `Project URL` | Frontend `.env` (VITE_SUPABASE_URL) |
| `anon public` | Frontend `.env` (VITE_SUPABASE_PUBLISHABLE_KEY) |
| `service_role` | Edge Functions secrets |
| `Project Reference` | Deploy de Edge Functions |

Navegue para **Settings > Database** e anote:
| Credencial | Onde Usar |
|------------|-----------|
| `Connection String` | Migrações diretas (opcional) |

---

## Etapa 1: Executar Schema

### Via SQL Editor (Recomendado)

1. No Supabase Dashboard, vá para **SQL Editor**
2. Clique em **New Query**
3. Cole o conteúdo do arquivo `schema_export.sql`
4. Clique em **Run** (pode demorar ~30 segundos)

### Verificar Execução

Após executar, navegue para **Table Editor** e verifique se as tabelas foram criadas:
- `profiles`
- `user_roles`
- `clients`
- `firewalls`
- `agents`
- etc.

---

## Etapa 2: Exportar Dados do Lovable Cloud

### Tabelas para Exportar (CSV)

No Lovable Cloud (Cloud > Database > Tables), exporte:

**Críticas:**
- `profiles`
- `user_roles`
- `user_module_permissions`
- `clients`
- `user_clients`

**Módulo Firewall:**
- `device_types`
- `device_blueprints`
- `compliance_rules`
- `agents`
- `firewalls`
- `analysis_history` (opcional)

**Módulo M365:**
- `m365_global_config`
- `m365_required_permissions`
- `modules`

**Configurações:**
- `system_settings`

### Ordem de Importação

⚠️ **IMPORTANTE**: Devido às foreign keys, importe na ordem:

1. `modules`
2. `clients`
3. `device_types`
4. `device_blueprints`
5. `compliance_rules`
6. `agents`
7. `firewalls`
8. `m365_global_config`
9. `m365_required_permissions`
10. `system_settings`

> **Nota**: Não importe `profiles`, `user_roles` e `user_module_permissions` ainda - eles serão criados automaticamente quando os usuários se registrarem.

---

## Etapa 3: Configurar Usuários Admin

### Criar Primeiro Usuário

1. Vá para **Authentication > Users** no Supabase Dashboard
2. Clique em **Add User > Create New User**
3. Configure:
   - **Email**: Seu email admin (ex: nn.mansberger@gmail.com)
   - **Password**: Senha segura
   - **Auto Confirm User**: ✅ Marcado
4. Clique em **Create User**

### Atribuir Role super_admin

Após criar o usuário, execute no **SQL Editor**:

```sql
-- Verificar se o profile foi criado automaticamente
SELECT * FROM profiles;

-- Se o profile não foi criado, insira manualmente:
INSERT INTO profiles (id, email, full_name)
SELECT id, email, raw_user_meta_data->>'full_name'
FROM auth.users
WHERE email = 'SEU_EMAIL_AQUI';

-- Garantir que o role é super_admin
UPDATE user_roles 
SET role = 'super_admin' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI');

-- Se não existe role, inserir
INSERT INTO user_roles (user_id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'SEU_EMAIL_AQUI'
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';

-- Adicionar permissões de módulo
INSERT INTO user_module_permissions (user_id, module_name, permission)
SELECT u.id, m.module_name, 'full'
FROM auth.users u
CROSS JOIN (VALUES ('dashboard'), ('firewall'), ('reports'), ('users'), ('m365')) AS m(module_name)
WHERE u.email = 'SEU_EMAIL_AQUI'
ON CONFLICT (user_id, module_name) DO UPDATE SET permission = 'full';
```

---

## Etapa 4: Configurar Edge Functions

### Instalar Supabase CLI

```bash
npm install -g supabase
```

### Login e Link

```bash
supabase login
supabase link --project-ref SEU_PROJECT_ID
```

### Configurar Secrets

No Supabase Dashboard, vá para **Settings > Edge Functions** e adicione:

| Secret Name | Valor |
|-------------|-------|
| `M365_ENCRYPTION_KEY` | (copiar do Lovable Cloud) |
| `M365_MULTI_TENANT_APP_ID` | (copiar do Lovable Cloud) |
| `M365_MULTI_TENANT_CLIENT_SECRET` | (copiar do Lovable Cloud) |

### Deploy das Functions

```bash
supabase functions deploy
```

Ou individualmente:
```bash
supabase functions deploy register-agent
supabase functions deploy agent-heartbeat
supabase functions deploy agent-tasks
supabase functions deploy agent-step-result
supabase functions deploy agent-task-result
supabase functions deploy trigger-firewall-analysis
supabase functions deploy fortigate-compliance
supabase functions deploy fortigate-cve
supabase functions deploy entra-id-compliance
supabase functions deploy entra-id-audit-logs
supabase functions deploy get-m365-config
supabase functions deploy update-m365-config
supabase functions deploy m365-oauth-callback
supabase functions deploy validate-m365-connection
supabase functions deploy validate-m365-permissions
supabase functions deploy create-user
```

---

## Etapa 5: Atualizar Frontend

### Arquivo `.env`

Atualize as variáveis de ambiente do projeto:

```env
VITE_SUPABASE_PROJECT_ID="SEU_NOVO_PROJECT_ID"
VITE_SUPABASE_PUBLISHABLE_KEY="SEU_NOVO_ANON_KEY"
VITE_SUPABASE_URL="https://SEU_NOVO_PROJECT_ID.supabase.co"
```

### Arquivo `src/integrations/supabase/client.ts`

Este arquivo será regenerado automaticamente pelo Lovable.

---

## Etapa 6: Atualizar Python Agent

### Arquivo `python-agent/.env`

```env
AGENT_API_BASE_URL=https://SEU_NOVO_PROJECT_ID.supabase.co/functions/v1
```

### Re-registrar Agent

1. Gere um novo activation code no painel
2. Atualize o `.env` do agent com o novo código
3. Reinicie o agent

---

## Validação Pós-Migração

### Checklist

- [ ] Login funciona com usuário admin
- [ ] Dashboard carrega sem erros
- [ ] Lista de firewalls aparece (se houver)
- [ ] Lista de clientes aparece (se houver)
- [ ] Agent consegue se registrar
- [ ] Agent envia heartbeat com sucesso
- [ ] Análise de firewall funciona
- [ ] Módulo M365 carrega configurações

### Queries de Verificação

Execute no SQL Editor:

```sql
-- Verificar usuários
SELECT p.email, ur.role FROM profiles p
JOIN user_roles ur ON p.id = ur.user_id;

-- Verificar clientes
SELECT * FROM clients;

-- Verificar agents
SELECT name, last_seen, revoked FROM agents;

-- Verificar firewalls
SELECT name, client_id, last_score FROM firewalls;
```

---

## Troubleshooting

### Erro: "permission denied for table X"

Verifique se as RLS policies foram criadas:
```sql
SELECT tablename, policyname FROM pg_policies 
WHERE schemaname = 'public';
```

### Erro: "function does not exist"

Verifique se as funções foram criadas:
```sql
SELECT proname FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace;
```

### Edge Function retorna 401

1. Verifique se os secrets estão configurados
2. Verifique se o token está sendo enviado corretamente
3. Verifique os logs da função no Supabase Dashboard

### Agent não conecta

1. Verifique a URL base no `.env` do agent
2. Verifique se a function `register-agent` foi deployada
3. Verifique os logs no Supabase Dashboard > Edge Functions

---

## Rollback

Se precisar reverter para o Lovable Cloud:

1. Restaure o `.env` original do frontend
2. Restaure o `.env` original do agent
3. Republique o projeto no Lovable

---

## Suporte

Em caso de problemas:
1. Verifique os logs no Supabase Dashboard
2. Verifique os logs do Edge Functions
3. Use o SQL Editor para queries de diagnóstico
