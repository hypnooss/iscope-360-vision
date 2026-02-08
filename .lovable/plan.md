
# Plano: Resolver Autorização do Exchange Online via Exchange.ManageAsApp

## Diagnóstico Completo

O erro `AADSTS50076` (MFA required) ocorre porque:
1. A autenticação via credenciais (`Connect-ExchangeOnline -Credential`) falha quando MFA está habilitado
2. A autenticação via CBA (`Connect-ExchangeOnline -CertificateFilePath`) falha porque o **Exchange.ManageAsApp** não está concedido

### O que é necessário para CBA funcionar

| Requisito | Status | Descrição |
|-----------|--------|-----------|
| Certificado registrado no App | ✅ | Já está registrado via `connect-m365-tenant` |
| Permissão `Exchange.ManageAsApp` | ❌ | **NÃO está no consentimento atual** |
| Role de diretório OU RBAC | ❌ | Opcional para escopo granular |

A permissão `Exchange.ManageAsApp` está no resource **Office 365 Exchange Online** (`00000002-0000-0ff1-ce00-000000000000`), não no Microsoft Graph que usamos atualmente.

## Solução: Incluir Exchange.ManageAsApp no Consentimento Admin

### Mudança de Arquitetura

Em vez de tentar configurar RBAC após a conexão, devemos:
1. **Incluir `Exchange.ManageAsApp`** nas permissões do consentimento admin inicial
2. **O CBA funcionará automaticamente** após o consentimento
3. **Remover a necessidade de credenciais de admin** para configuração

### Alterações Necessárias

#### 1. Atualizar o Device Code Flow para incluir Exchange scope

**Arquivo**: `supabase/functions/connect-m365-tenant/index.ts`

```typescript
// ANTES (linha 50)
scope: 'https://graph.microsoft.com/.default offline_access',

// DEPOIS - incluir Exchange Online scope
scope: 'https://graph.microsoft.com/.default https://outlook.office365.com/.default offline_access',
```

**Problema**: Scopes de recursos diferentes não podem ser combinados em uma única requisição OAuth!

#### Solução Alternativa: Consentimento via URL Admin

O Device Code Flow não suporta múltiplos resources. A solução é usar o **Admin Consent URL** que já é usado para consent:

**Arquivo**: `src/hooks/useTenantConnection.ts` ou similar

```typescript
// URL de consentimento admin que inclui Exchange.ManageAsApp
const adminConsentUrl = `https://login.microsoftonline.com/${tenantId}/adminconsent?` +
  `client_id=${appId}` +
  `&redirect_uri=${encodeURIComponent(redirectUri)}`;
```

O problema é que as permissões precisam estar **pré-configuradas no App Registration** no Azure Portal.

### Fluxo Correto

```text
┌────────────────────────────────────────────────────────────────────┐
│ CONFIGURAÇÃO ÚNICA NO AZURE (Home Tenant - Precisio)               │
│                                                                     │
│ 1. Adicionar permissão Exchange.ManageAsApp ao App Registration    │
│    API: Office 365 Exchange Online                                  │
│    Permissão: Exchange.ManageAsApp (Application)                   │
│                                                                     │
│ 2. Conceder admin consent no home tenant                           │
└────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│ PARA CADA TENANT CLIENTE                                           │
│                                                                     │
│ 1. Admin do cliente faz consentimento (Device Code Flow já existe) │
│    → Exchange.ManageAsApp é automaticamente incluído               │
│                                                                     │
│ 2. Após consentimento, o app pode usar CBA automaticamente!        │
│    → Connect-ExchangeOnline -CertificateFilePath ... funciona      │
│                                                                     │
│ 3. NÃO PRECISA de New-ServicePrincipal ou New-ManagementRoleAssign │
│    (a menos que queira limitar escopo a mailboxes específicas)     │
└────────────────────────────────────────────────────────────────────┘
```

## Ação Imediata Necessária (No Azure Portal)

Você precisa adicionar a permissão `Exchange.ManageAsApp` ao App Registration **800e141d-2dd6-4fa7-b19b-4a284f584d32** no Azure Portal:

1. Acesse Azure Portal → App Registrations → iScope Security
2. API Permissions → Add a permission
3. Selecione **APIs my organization uses** → procure "Office 365 Exchange Online"
4. Application permissions → **Exchange.ManageAsApp** ✓
5. Grant admin consent for Precisio

### Após adicionar no Home Tenant

O admin do tenant cliente (TASCHIBRA) precisa re-consentir:
1. Clique novamente em "Conectar Tenant" 
2. Faça o Device Code Flow
3. Após consentimento, as permissões Exchange.ManageAsApp são herdadas

## Alterações no Código (Após configurar no Azure)

### 1. Remover lógica de RBAC manual

**Arquivo**: `supabase/functions/setup-exchange-rbac/index.ts`

Pode ser **simplificado** para apenas verificar se a conexão CBA funciona:
- Remove a necessidade de credenciais
- Apenas testa a conexão CBA
- Marca o tenant como "Exchange configurado" se sucesso

### 2. Atualizar o Dialog

**Arquivo**: `src/components/m365/ExchangeRbacSetupDialog.tsx`

Transformar em um dialog de **verificação** ao invés de configuração:
- Remove campos de credenciais
- Mostra botão "Verificar Conexão Exchange"
- Dispara teste CBA via agent
- Se sucesso: marca como configurado
- Se falha: orienta a re-consentir

### 3. Atualizar texto do botão

**Arquivo**: `src/components/m365/TenantStatusCard.tsx`

- "Permissões" → "Permissões Graph API"
- "Configurar Exchange" → "Permissões RBAC"

Estes ajustes de texto você já solicitou e eu aplico agora.

## Resumo

| O que fazer | Quem faz | Onde |
|-------------|----------|------|
| Adicionar Exchange.ManageAsApp | Admin Precisio | Azure Portal |
| Re-consentir tenant cliente | Admin TASCHIBRA | Device Code Flow |
| Atualizar UI/edge function | Este plano | Código |

## Alterações de Código Imediatas

Posso fazer agora as seguintes alterações que foram solicitadas:

1. **Renomear botão "Permissões"** → **"Permissões Graph API"**
2. **Renomear botão "Configurar Exchange"** → **"Permissões RBAC"**
3. **Corrigir o payload da edge function** (já feito na última mensagem)

---

## Pergunta

Antes de prosseguir com as alterações de código, você precisa adicionar a permissão **Exchange.ManageAsApp** no Azure Portal. Deseja que eu apresente instruções detalhadas passo-a-passo para essa configuração?
