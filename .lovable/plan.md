

# Plano: Corrigir Fluxo de Conexão M365 - Salvar spObjectId no OAuth Callback

## Diagnóstico

O sistema já possui toda a lógica necessária, mas uma peça está faltando:

| Componente | O que faz | Problema |
|------------|-----------|----------|
| `m365-oauth-callback` | Busca `servicePrincipalId` (linha 44-64) | Não salva no banco |
| `setup-exchange-rbac` | Configura RBAC via Agent/PowerShell | Precisa do `spObjectId` mas não encontra |
| `TenantConnectionWizard` | Usa Admin Consent popup | Funciona, mas não dispara setup RBAC |
| `SimpleTenantConnectionWizard` | Usa Device Code Flow | Requer config manual no Azure |

O `servicePrincipalId` é buscado no callback mas **não é persistido**. Por isso o `setup-exchange-rbac` falha.

## Arquitetura da Solução

```text
FLUXO ATUAL (QUEBRADO)
──────────────────────
OAuth Callback                    setup-exchange-rbac
      │                                  │
      ├─ Busca spObjectId ✓              ├─ Precisa spObjectId
      ├─ Tenta atribuir role (FALHA)     ├─ Não encontra no banco (FALHA)
      └─ NÃO SALVA spObjectId            └─ Erro: SP_OBJECT_ID_REQUIRED


FLUXO CORRIGIDO
───────────────
OAuth Callback                    setup-exchange-rbac
      │                                  │
      ├─ Busca spObjectId ✓              ├─ Busca spObjectId do banco ✓
      ├─ SALVA no banco ✓                ├─ Cria task para Agent ✓
      └─ (Role assignment opcional)      └─ Agent executa PowerShell ✓
```

## Alterações Necessárias

### 1. Migração SQL: Adicionar coluna sp_object_id

```sql
ALTER TABLE m365_app_credentials 
ADD COLUMN IF NOT EXISTS sp_object_id TEXT;

COMMENT ON COLUMN m365_app_credentials.sp_object_id IS 
  'Service Principal Object ID no tenant do cliente, usado para setup do Exchange RBAC via PowerShell';
```

### 2. Edge Function: m365-oauth-callback/index.ts

Na função `assignExchangeAdminRole` (linha 37-128), o `servicePrincipalId` já é obtido.

Modificar o upsert de credentials (linha 675-686) para incluir o `sp_object_id`:

```typescript
// Linha ~628: Já chama assignExchangeAdminRole que retorna o spObjectId internamente
// Precisamos extrair o spObjectId ANTES de tentar atribuir a role

// NOVA LÓGICA: Buscar spObjectId separadamente
const spResponse = await fetch(
  `https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${appId}'&$select=id,displayName`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);
const spData = await spResponse.json();
const spObjectId = spData.value?.[0]?.id || null;

console.log('Service Principal Object ID:', spObjectId);

// Linha ~675-686: Modificar upsert para incluir sp_object_id
const { error: credError } = await supabase
  .from('m365_app_credentials')
  .upsert({
    tenant_record_id,
    azure_app_id: appId,
    sp_object_id: spObjectId,  // NOVO CAMPO
    auth_type: 'multi_tenant_app',
    is_active: true,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'tenant_record_id',
  });
```

### 3. Edge Function: setup-exchange-rbac/index.ts

Modificar para buscar `sp_object_id` do banco se não fornecido (linha 139-149):

```typescript
// Se spObjectId não fornecido, buscar do banco
if (!spObjectId) {
  const { data: creds, error: credsError } = await supabase
    .from('m365_app_credentials')
    .select('sp_object_id')
    .eq('tenant_record_id', tenantRecordId)
    .single();
  
  if (credsError || !creds?.sp_object_id) {
    console.error('SP Object ID not found in database:', credsError);
    return new Response(
      JSON.stringify({ 
        error: "Service Principal não encontrado. Reconecte o tenant para resolver.",
        code: "SP_OBJECT_ID_NOT_FOUND"
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  
  spObjectId = creds.sp_object_id;
  console.log('SP Object ID loaded from database:', spObjectId);
}
```

### 4. Frontend: SimpleTenantConnectionWizard.tsx

Substituir Device Code Flow por Admin Consent Flow (mesma lógica do `TenantConnectionWizard`):

- Remover estado de `deviceCodeData`, `timeRemaining`, `pollingRef`
- Remover funções `startPolling`, `handleCopyCode`
- Adicionar lógica de Admin Consent popup
- Ouvir mensagens do popup via `window.addEventListener('message')`

```typescript
const handleStart = async () => {
  // 1. Descobrir tenant_id do email
  const emailDomain = adminEmail.split('@')[1];
  const tenantId = await discoverTenantId(emailDomain);
  
  // 2. Criar tenant record pendente
  const { data: tenant } = await supabase
    .from('m365_tenants')
    .insert({
      client_id: selectedClientId,
      tenant_id: tenantId,
      connection_status: 'pending',
      created_by: user?.id,
    })
    .select()
    .single();
  
  // 3. Linkar agent automaticamente
  // 4. Buscar app_id via get-m365-config
  // 5. Abrir popup Admin Consent
  const consentUrl = new URL(`https://login.microsoftonline.com/${tenantId}/adminconsent`);
  consentUrl.searchParams.set('client_id', appId);
  consentUrl.searchParams.set('redirect_uri', callbackUrl);
  consentUrl.searchParams.set('state', statePayload);
  
  window.open(consentUrl.toString(), 'microsoft_auth', 'width=600,height=700');
  setWaitingForAuth(true);
};
```

## Resumo das Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| Migration SQL | NEW | Adicionar coluna `sp_object_id` |
| `m365-oauth-callback/index.ts` | EDIT | Salvar `sp_object_id` no upsert de credentials |
| `setup-exchange-rbac/index.ts` | EDIT | Buscar `sp_object_id` do banco se não fornecido |
| `SimpleTenantConnectionWizard.tsx` | EDIT | Usar Admin Consent ao invés de Device Code |

## Por que isso resolve

1. **Admin Consent** não requer configuração manual no Azure ("Allow public client flows")
2. **spObjectId** é buscado automaticamente via token de aplicação após consent
3. **spObjectId é salvo** no banco para uso posterior
4. **setup-exchange-rbac** consegue buscar o spObjectId do banco
5. **Exchange RBAC** é configurado via Agent/PowerShell usando AUTH_MODE_CREDENTIAL
6. **MFA funciona** porque o admin autentica interativamente no popup

## Fluxo Final Completo

```text
1. Usuario digita email do admin no SimpleTenantConnectionWizard
2. Sistema descobre tenant_id do dominio do email
3. Sistema cria tenant record + linka agent automaticamente
4. Sistema abre popup Admin Consent
5. Global Admin clica "Accept" (MFA suportado!)
6. m365-oauth-callback:
   - Obtém token de aplicação via client_credentials
   - Busca spObjectId via Graph API
   - SALVA spObjectId no banco (NOVO!)
   - Valida permissões
7. Popup fecha e SimpleTenantConnectionWizard mostra sucesso
8. Usuario vai para "Configurar Exchange" (card no dashboard)
9. setup-exchange-rbac:
   - Busca spObjectId do banco (NOVO!)
   - Cria task para Agent com AUTH_MODE_CREDENTIAL
10. Agent executa PowerShell: New-ServicePrincipal + New-ManagementRoleAssignment
11. Exchange RBAC configurado!
```

## Dependências

- A coluna `sp_object_id` precisa existir antes de deployar as edge functions

