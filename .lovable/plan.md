
# Plano: Migração do Banco de Dados para Supabase Próprio

## Visão Geral

A migração envolve exportar o schema e dados do Lovable Cloud para um projeto Supabase que você controlará completamente. A compatibilidade com o código existente será mantida - apenas alteraremos as variáveis de ambiente.

---

## Pré-Requisitos

1. Criar um novo projeto no [Supabase Dashboard](https://supabase.com/dashboard)
2. Anotar as credenciais:
   - `SUPABASE_URL` (ex: `https://xxxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` (chave pública)
   - `SUPABASE_SERVICE_ROLE_KEY` (chave privada para Edge Functions)
   - `DATABASE_URL` (string de conexão PostgreSQL)

---

## Etapa 1: Exportar Schema do Lovable Cloud

Vou gerar um arquivo SQL consolidado com todo o schema atual (28 tabelas, enums, funções, triggers e RLS policies). Este arquivo será criado combinando todas as migrations existentes.

**Arquivo a criar**: `docs/migration/schema_export.sql`

---

## Etapa 2: Exportar Dados Atuais

Você precisará exportar os dados usando a interface do Lovable Cloud:
1. Acessar Cloud > Database > Tables
2. Para cada tabela com dados importantes, usar o botão de exportar CSV
3. Tabelas críticas para exportar:
   - `profiles`
   - `user_roles`
   - `clients`
   - `firewalls`
   - `agents`
   - `device_types`
   - `device_blueprints`
   - `compliance_rules`
   - `modules`
   - `m365_global_config`
   - `system_settings`

---

## Etapa 3: Preparar Novo Projeto Supabase

No seu novo projeto Supabase:

1. **Executar o schema SQL** via SQL Editor do Dashboard
2. **Importar dados CSV** via Table Editor
3. **Configurar Secrets** para Edge Functions:
   - `M365_ENCRYPTION_KEY`
   - `M365_MULTI_TENANT_APP_ID`
   - `M365_MULTI_TENANT_CLIENT_SECRET`

---

## Etapa 4: Atualizar Variáveis de Ambiente

Atualizar o arquivo `.env` do projeto para apontar para o novo Supabase:

```env
VITE_SUPABASE_PROJECT_ID="SEU_NOVO_PROJECT_ID"
VITE_SUPABASE_PUBLISHABLE_KEY="SEU_NOVO_ANON_KEY"
VITE_SUPABASE_URL="https://SEU_NOVO_PROJECT_ID.supabase.co"
```

---

## Etapa 5: Deploy Edge Functions no Novo Projeto

As Edge Functions precisam ser redeployadas no novo projeto:

1. Instalar Supabase CLI: `npm install supabase --save-dev`
2. Login: `npx supabase login`
3. Link ao projeto: `npx supabase link --project-ref SEU_NOVO_PROJECT_ID`
4. Deploy: `npx supabase functions deploy`

---

## Etapa 6: Atualizar Python Agent

Atualizar o `.env` do Agent para apontar para o novo endpoint:

```env
AGENT_API_BASE_URL=https://SEU_NOVO_PROJECT_ID.supabase.co/functions/v1
```

O Agent precisará ser re-registrado (novo activation code).

---

## Resumo de Alterações de Código

| Arquivo | Alteração |
|---------|-----------|
| `.env` | Novas credenciais Supabase |
| `python-agent/.env` | Novo `AGENT_API_BASE_URL` |
| `docs/migration/schema_export.sql` | **Novo** - Schema consolidado para importar |
| `docs/migration/migration_guide.md` | **Novo** - Guia passo-a-passo |

---

## Arquivos a Serem Gerados

### 1. `docs/migration/schema_export.sql`
Schema SQL consolidado contendo:
- Todos os ENUMs (app_role, module_permission, etc.)
- Todas as 28 tabelas com constraints
- Todas as funções (has_role, has_client_access, etc.)
- Todos os triggers (handle_new_user, update_updated_at, etc.)
- Todas as RLS policies
- Configuração de Realtime

### 2. `docs/migration/migration_guide.md`
Guia detalhado com:
- Checklist de pré-migração
- Comandos passo-a-passo
- Troubleshooting comum
- Validação pós-migração

---

## Vantagens Após Migração

1. **Dashboard completo** - Visualizar conexões, CPU, memória em tempo real
2. **SQL Editor** - Executar queries diretamente para debug
3. **Logs detalhados** - Ver erros de Realtime, Auth, e Edge Functions
4. **Configurações** - Ajustar statement_timeout, connection pooling
5. **Backups** - Controle sobre Point-in-Time Recovery
6. **Escalabilidade** - Upgrade para Pro ($25/mês) quando necessário

---

## Cronograma Estimado

| Fase | Tempo |
|------|-------|
| Criar projeto + importar schema | 30 min |
| Exportar e importar dados | 1 hora |
| Configurar secrets + deploy functions | 30 min |
| Testes e validação | 1 hora |
| **Total** | ~3 horas |

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Perda de dados durante migração | Exportar CSV antes de qualquer alteração |
| Auth users não migram automaticamente | Usuários precisarão criar novas contas OU usar migration script |
| Edge Functions falham | Testar cada função individualmente antes de desativar Lovable Cloud |

---

## Nota Importante: Migração de Usuários

Os usuários em `auth.users` (Supabase Auth) **não são migráveis diretamente** entre projetos. Opções:

**Opção A (Recomendada para poucos usuários):**
- Usuários criam novas contas no novo sistema
- Você recria os roles manualmente

**Opção B (Para muitos usuários):**
- Usar script de migração com Supabase Admin API
- Requer acesso programático aos dois projetos

Para o InfraScope360 com poucos admins, a Opção A é mais simples.
