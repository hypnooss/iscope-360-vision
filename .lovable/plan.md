
# Plano: Corrigir Setup do Exchange RBAC + Alterar Textos dos Botões

## Diagnóstico do Erro

A tarefa de configuração do Exchange RBAC falhou porque há uma incompatibilidade entre os nomes dos campos no payload:

| Campo esperado pelo Agent (`tasks.py`) | Campo enviado pela Edge Function (`setup-exchange-rbac`) |
|----------------------------------------|----------------------------------------------------------|
| `password_encrypted` | `admin_password_encrypted` |
| `username` | `admin_email` |
| `transport_key` | **NÃO ENVIADO** |

O `transport_key` não é passado para o agent, impedindo a descriptografia da senha.

---

## Correções Necessárias

### 1. Corrigir Edge Function `setup-exchange-rbac`

Ajustar os nomes dos campos no payload para corresponder ao esperado pelo agent:

**Arquivo**: `supabase/functions/setup-exchange-rbac/index.ts`

**Alterações**:
```typescript
// ANTES (linha 168-172)
payload: {
  type: 'exchange_rbac_setup',
  module: 'ExchangeOnline',
  auth_mode: 'credential',
  admin_email: admin_email,
  admin_password_encrypted: encryptedPassword,
  commands: setupCommands,
  tenant_id: tenant.tenant_id,
  organization: tenant.tenant_domain,
}

// DEPOIS
payload: {
  type: 'exchange_rbac_setup',
  module: 'ExchangeOnline',
  auth_mode: 'credential',
  username: admin_email,                    // RENOMEAR
  password_encrypted: encryptedPassword,    // RENOMEAR
  transport_key: encryptionKey,             // ADICIONAR
  commands: setupCommands,
  tenant_id: tenant.tenant_id,
  organization: tenant.tenant_domain,
}
```

---

### 2. Alterar Textos dos Botões no `TenantStatusCard`

**Arquivo**: `src/components/m365/TenantStatusCard.tsx`

| Botão Atual | Novo Texto | Função |
|-------------|------------|--------|
| "Permissões" | "Permissões Graph API" | Validar permissões do aplicativo no Graph API |
| "Configurar Exchange" | "Permissões RBAC" | Validar/configurar permissões no Exchange Online e SharePoint Online |

**Alterações (linhas 443-465)**:

```tsx
// Botão "Permissões" -> "Permissões Graph API"
{onUpdatePermissions && (
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => onUpdatePermissions(tenant.id)}
    disabled={tenant.connection_status === 'disconnected'}
  >
    <ExternalLink className="w-3 h-3 mr-1" />
    Permissões Graph API  {/* ALTERADO */}
  </Button>
)}

// Botão "Configurar Exchange" -> "Permissões RBAC"
{(tenant.connection_status === 'connected' || tenant.connection_status === 'partial') && (
  <Button 
    variant="outline" 
    size="sm"
    onClick={() => setShowExchangeRbacDialog(true)}
    className="text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 border-border"
  >
    <Settings2 className="w-3 h-3 mr-1" />
    Permissões RBAC  {/* ALTERADO */}
  </Button>
)}
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/functions/setup-exchange-rbac/index.ts` | Corrigir nomes dos campos no payload |
| `src/components/m365/TenantStatusCard.tsx` | Alterar textos dos botões |

---

## Resultado Esperado

1. **Botão "Permissões Graph API"**: Abre consentimento admin para atualizar permissões do Graph API
2. **Botão "Permissões RBAC"**: Abre modal para configurar Exchange e SharePoint via credenciais de admin

Após as correções, ao clicar em "Permissões RBAC" e informar as credenciais, o agent conseguirá:
1. Descriptografar a senha usando o `transport_key`
2. Conectar ao Exchange Online com credenciais
3. Executar `New-ServicePrincipal` e `New-ManagementRoleAssignment`
