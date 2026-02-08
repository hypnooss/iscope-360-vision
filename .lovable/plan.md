

#LEMBRAR DAS REGRAS
NENHUMA DIFICULDADE PARA O USUARIO!

O FLUXO INDICADO ESTA CRIANDO FACILIDDE OU DIFICULDADE ?

# Plano: Corrigir Fluxo de Autenticação RBAC do Exchange

## Diagnóstico

O erro `UnAuthorized` ao testar conexão com Exchange Online ocorre porque:

| Componente | Status | Problema |
|------------|--------|----------|
| Certificado do Agent | ✅ Registrado | No App Registration do home tenant (Precisio) |
| Exchange RBAC | ❌ Não configurado | `New-ServicePrincipal` e `New-ManagementRoleAssignment` não foram executados |
| Tentativa de conexão | ❌ Falha | CBA exige RBAC configurado, mas RBAC exige conexão para configurar |

### O Problema Específico

O código em `connect-m365-tenant/index.ts` (linha 445) cria a tarefa de setup RBAC com:
```typescript
auth_mode: 'certificate', // Use CBA instead of credentials
```

Mas **CBA não funciona** para configurar o RBAC porque:
1. O certificado está no home tenant, não no tenant cliente
2. O RBAC precisa ser configurado antes do CBA funcionar para operações no Exchange

---

## Solução

Modificar o fluxo para que a configuração inicial do RBAC use autenticação baseada em **credenciais de administrador** (já suportada pelo executor PowerShell), e depois de configurado, as operações normais usem CBA.

### Opção A: Fluxo Automático com Credenciais (Recomendado)

1. Na UI de conexão do tenant, adicionar campos para credenciais de admin do Exchange
2. Criar tarefa de RBAC setup com `auth_mode: 'credential'`
3. Após sucesso, marcar tenant como "Exchange Authorized"
4. Operações subsequentes usam CBA normalmente

### Opção B: Fluxo Manual

1. Exibir instruções para o admin executar os comandos PowerShell manualmente
2. Após execução manual, permitir testar a conexão
3. Marcar tenant como "Exchange Authorized" após teste bem-sucedido

---

## Alterações Necessárias

### 1. Atualizar `connect-m365-tenant/index.ts`

**Problema**: Linha 445 usa `auth_mode: 'certificate'` 

**Solução**: Remover a criação automática da tarefa RBAC na conexão inicial, pois ela sempre falhará

```typescript
// ANTES (linhas 421-457)
// Create Exchange RBAC setup task using Certificate-Based Auth
const setupCommands = [...];
const { error: taskError } = await supabase.from('agent_tasks').insert({...});

// DEPOIS
// Não criar tarefa automática - RBAC precisa ser configurado 
// via fluxo separado com credenciais de admin
console.log('[connect-m365-tenant] RBAC setup will be handled via dedicated flow');
```

### 2. Criar Edge Function `setup-exchange-rbac`

Nova edge function que:
1. Recebe credenciais de admin (email/senha) via request seguro
2. Cria tarefa para o agent com `auth_mode: 'credential'`
3. Executa `New-ServicePrincipal` e `New-ManagementRoleAssignment`
4. Atualiza permissões no banco após sucesso

### 3. Atualizar UI `TenantStatusCard.tsx`

Adicionar botão "Configurar Exchange" que abre modal para:
1. Informar credenciais de admin do Exchange
2. Disparar configuração via `setup-exchange-rbac`
3. Exibir progresso e resultado

### 4. Adicionar colunas no banco (m365_tenants ou nova tabela)

```sql
ALTER TABLE m365_tenants ADD COLUMN exchange_sp_registered BOOLEAN DEFAULT FALSE;
ALTER TABLE m365_tenants ADD COLUMN exchange_rbac_assigned BOOLEAN DEFAULT FALSE;
```

---

## Fluxo Atualizado

```text
┌─────────────────────────────────────────────────────────────────┐
│                    CONEXÃO DO TENANT                             │
│  1. Admin faz login via Device Code                              │
│  2. Sistema valida permissões Graph API                          │
│  3. Tenant salvo com status "partial"                            │
│  4. Exchange RBAC: ❌ Não configurado                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                 CONFIGURAÇÃO DO EXCHANGE (NOVO)                  │
│  1. Admin clica "Configurar Exchange" na UI                      │
│  2. Informa credenciais de admin                                 │
│  3. Sistema cria tarefa com auth_mode: 'credential'              │
│  4. Agent executa New-ServicePrincipal + New-ManagementRole      │
│  5. Sucesso → Exchange RBAC: ✅ Configurado                      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OPERAÇÕES NORMAIS                             │
│  - Coletas de dados do Exchange usam CBA                         │
│  - Certificado do agent já está no App Registration              │
│  - Conexões subsequentes não precisam de credenciais             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/connect-m365-tenant/index.ts` | Remover criação automática de tarefa RBAC |
| `supabase/functions/setup-exchange-rbac/index.ts` | **Criar** - Nova edge function para RBAC setup |
| `src/components/m365/TenantStatusCard.tsx` | Adicionar botão/modal para configurar Exchange |
| `src/hooks/useTenantConnection.ts` | Adicionar função para disparar setup RBAC |
| Migrations | Adicionar colunas de status RBAC |

---

## Segurança das Credenciais

1. Credenciais são enviadas via HTTPS para edge function
2. Edge function usa criptografia XOR (já existente) para enviar ao agent
3. Agent executa comandos e descarta credenciais
4. Credenciais **nunca são persistidas** no banco

---

## Alternativa Simplificada (Implementação Rápida)

Se quiser testar rapidamente sem modificar todo o fluxo:

1. Executar manualmente no PowerShell (como admin do Exchange):
```powershell
Connect-ExchangeOnline

# Registrar o app como Service Principal
New-ServicePrincipal -AppId "800e141d-2dd6-4fa7-b19b-4a284f584d32" -ObjectId "<SP_OBJECT_ID>" -DisplayName "iScope Security"

# Atribuir role
New-ManagementRoleAssignment -App "800e141d-2dd6-4fa7-b19b-4a284f584d32" -Role "Exchange Recipient Administrator"
```

2. Após executar, o teste de conexão CBA deve funcionar

**Nota**: O `SP_OBJECT_ID` pode ser obtido do Azure Portal → Enterprise Applications → iScope Security → Object ID

