

# Plano: Automatizar Atribuição de Permissões Exchange Online

## Contexto

O sistema atualmente falha ao conectar via PowerShell porque o App Registration não possui a role Exchange Administrator atribuída. A atribuição automática via Graph API falha com "Insufficient privileges" porque um Service Principal **não pode atribuir roles privilegiadas a si mesmo** - isso é uma proteção de segurança da Microsoft.

## Descoberta Chave

A Microsoft oferece **dois caminhos** para autorizar apps a executar comandos PowerShell no Exchange Online:

| Método | Onde Configurar | Auto-atribuição | Pré-requisito |
|--------|-----------------|-----------------|---------------|
| Azure AD Directory Role | Microsoft Entra Admin Center | Não (proteção contra privilege escalation) | Privileged Role Administrator |
| **Exchange Online RBAC for Applications** | PowerShell Exchange Online | **Sim, via Agent** | Organization Management role |

A segunda opção permite configurar via PowerShell usando:
```powershell
New-ServicePrincipal -AppId "<AppID>" -ObjectId "<SPObjectID>" -DisplayName "<Name>"
New-ManagementRoleAssignment -App "<AppID>" -Role "View-Only Organization Management"
```

## Solução Proposta

### Fase 1: Criar Task de Setup Automático no Agent

Quando o tenant é conectado e ainda não tem permissões de Exchange configuradas, o sistema dispara uma task PowerShell para o Agent vinculado que:

1. Conecta ao Exchange Online com as credenciais do admin (primeira vez)
2. Registra o Service Principal do App no Exchange
3. Atribui as roles necessárias

### Arquivos a Modificar

#### 1. `supabase/functions/m365-oauth-callback/index.ts`

Após o consent bem-sucedido, ao invés de tentar atribuir a role via Graph API, criar uma flag indicando que o setup de Exchange RBAC está pendente.

Mudanças:
- Remover tentativa de `assignExchangeAdminRole` via Graph (que sempre falha)
- Adicionar campo `exchange_rbac_status: 'pending'` ao tenant

#### 2. Nova Edge Function: `setup-exchange-rbac/index.ts`

Cria uma task PowerShell para o Agent executar os comandos de configuração:
```powershell
# Conectar como Global Admin (delegated auth) ou usando token do admin
Connect-ExchangeOnline -UserPrincipalName "admin@contoso.com" -ShowBanner:$false

# Registrar Service Principal do App
New-ServicePrincipal -AppId "<APP_ID>" -ObjectId "<SP_OBJECT_ID>" -DisplayName "iScope M365 App"

# Atribuir role View-Only Organization Management (read-only) ou Organization Management (full)
New-ManagementRoleAssignment -App "<APP_ID>" -Role "View-Only Organization Management"

Disconnect-ExchangeOnline -Confirm:$false
```

#### 3. `src/components/m365/TenantStatusCard.tsx`

Adicionar botão para iniciar o setup de RBAC quando Exchange Admin Role estiver pendente.

#### 4. `python-agent/agent/executors/powershell.py`

Adicionar suporte para conexão delegated (com credenciais de admin) para o setup inicial.

## Problema com Esta Abordagem

O comando `New-ServicePrincipal` e `New-ManagementRoleAssignment` requer que quem executa seja membro do role group **Organization Management** no Exchange Online.

Isso significa que alguém (humano admin) precisa executar esses comandos **pelo menos uma vez** manualmente, ou:
- O Agent precisa conectar usando credenciais de um Global Admin (delegated flow)
- Usar interactive login no portal

## Alternativa Mais Simples (Recomendada)

Dado que a Microsoft impede auto-atribuição de roles privilegiadas por design de segurança, a solução mais pragmática é:

### UX Guiada para Configuração Manual

1. Na UI do tenant, quando Exchange Admin Role estiver pendente, exibir um painel explicativo
2. Mostrar os comandos PowerShell exatos que o admin do cliente precisa executar
3. Incluir botão "Copiar Comandos" e link para o Exchange Admin Center
4. Após execução manual, o admin clica em "Verificar Configuração" para revalidar

Comandos a fornecer:
```powershell
# 1. Conectar ao Exchange Online
Connect-ExchangeOnline

# 2. Registrar o Service Principal do iScope
New-ServicePrincipal -AppId "{APP_ID}" -ObjectId "{SP_OBJECT_ID}" -DisplayName "iScope Security"

# 3. Atribuir permissões de leitura de organização
New-ManagementRoleAssignment -App "{APP_ID}" -Role "View-Only Organization Management"

# 4. Desconectar
Disconnect-ExchangeOnline -Confirm:$false
```

### Arquivos para Implementar Esta Solução

| Arquivo | Mudança |
|---------|---------|
| `src/components/m365/ExchangeRBACSetupCard.tsx` | Novo componente com instruções e comandos |
| `src/components/m365/TenantStatusCard.tsx` | Integrar o ExchangeRBACSetupCard quando necessário |
| `supabase/functions/validate-m365-connection/index.ts` | Adicionar verificação de RBAC no Exchange (usando test cmdlet) |

## Vantagens

1. **Funciona sempre** - Não depende de permissões especiais do app
2. **Segurança** - Respeita o modelo de segurança da Microsoft
3. **Transparência** - Admin sabe exatamente o que está sendo configurado
4. **One-time** - Configuração feita uma única vez por tenant

## Resultado Final

O fluxo de onboarding ficaria:

1. Admin conecta tenant via Admin Consent ✅
2. Sistema valida permissões Graph API ✅
3. Sistema detecta que Exchange RBAC não está configurado
4. UI exibe painel com instruções de configuração
5. Admin executa comandos PowerShell (2 minutos)
6. Admin clica em "Verificar" - sistema confirma configuração
7. Agent pode executar análises PowerShell no Exchange

