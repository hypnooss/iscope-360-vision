
# Plano: Corrigir Redirecionamento OAuth e Implementar Edição de Tenant

## Diagnóstico dos Problemas

### Problema 1: Redirecionamento para Página de Login

A edge function `m365-oauth-callback` recebe a URL de redirecionamento do parâmetro `state` que foi definido no momento da criação do tenant. Essa URL é construída usando `window.location.origin`:

```typescript
// TenantConnectionWizard.tsx linha 170
redirect_url: `${window.location.origin}/scope-m365/tenant-connection`
```

O problema ocorre quando o usuário acessa a aplicação por diferentes domínios:
- Preview: `https://1bc80744-8bb3-4e4a-9b4f-eac733214c67.lovableproject.com`
- Publicado: `https://iscope360.lovable.app`

Se o usuário inicia o fluxo OAuth a partir do preview mas o callback redireciona para o preview, e a sessão de autenticação do usuário está associada ao domínio publicado (ou vice-versa), o usuário aparece como não autenticado.

**Evidência nos logs:**
```text
Redirecting to: https://1bc80744-8bb3-4e4a-9b4f-eac733214c67.lovableproject.com/scope-m365/tenant-connection?success=partial
```

O `TenantConnectionPage.tsx` possui uma verificação que redireciona para `/auth` quando não há usuário logado:
```typescript
// linha 64-68
if (!authLoading && !user) {
  navigate('/auth');
}
```

### Problema 2: Edição de Tenant Não Implementada

A funcionalidade de edição de tenant **não existe**. O `handleUpdatePermissions` está marcado como TODO:
```typescript
// TenantConnectionPage.tsx linha 127-133
const handleUpdatePermissions = (tenantId: string) => {
  // TODO: Open update permissions wizard for the specific tenant
  toast({
    title: 'Em desenvolvimento',
    description: 'O upgrade de permissões será implementado em breve.',
  });
};
```

O `TenantStatusCard` não possui botão de edição, apenas:
- Testar conexão
- Atualizar permissões (não funciona)
- Desconectar
- Excluir

---

## Solução Proposta

### Correção 1: Usar URL Publicada para Redirecionamento OAuth

Modificar o `TenantConnectionWizard.tsx` para usar sempre a URL publicada como destino do callback, garantindo consistência:

**Arquivo**: `src/components/m365/TenantConnectionWizard.tsx`

```typescript
// Linha ~170 - Alterar de:
redirect_url: `${window.location.origin}/scope-m365/tenant-connection`,

// Para:
redirect_url: `https://iscope360.lovable.app/scope-m365/tenant-connection`,
```

Alternativamente, usar uma variável de ambiente ou configuração para definir a URL base da aplicação.

### Correção 2: Implementar Dialog de Edição de Tenant

Criar um novo componente `TenantEditDialog` similar ao `AdminEditDialog` para permitir edição dos campos:
- Display Name
- Domínio do Tenant
- Cliente associado (se houver múltiplos)

**Novo arquivo**: `src/components/m365/TenantEditDialog.tsx`

O dialog deve:
1. Receber o tenant atual como prop
2. Permitir editar campos editáveis
3. Salvar alterações no banco via Supabase
4. Registrar no audit log

**Integração no TenantStatusCard**:
1. Adicionar botão de edição (ícone de lápis)
2. Prop `onEdit` para abrir o dialog
3. Handler no `TenantConnectionPage` para gerenciar estado do dialog

---

## Arquivos a Modificar/Criar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/m365/TenantConnectionWizard.tsx` | Modificar | Usar URL fixa ou configurável para redirect_url |
| `src/components/m365/TenantEditDialog.tsx` | Criar | Dialog para editar tenant |
| `src/components/m365/TenantStatusCard.tsx` | Modificar | Adicionar botão de edição |
| `src/pages/m365/TenantConnectionPage.tsx` | Modificar | Adicionar handler e estado para edição |
| `src/hooks/useTenantConnection.ts` | Modificar | Adicionar função `updateTenant` |

---

## Detalhes de Implementação

### 1. TenantConnectionWizard.tsx - Correção do Redirect

```typescript
// Usar URL publicada como base para evitar problemas de sessão cross-domain
const getAppBaseUrl = () => {
  // Priorizar URL publicada se disponível
  const publishedUrl = 'https://iscope360.lovable.app';
  
  // Em desenvolvimento, pode usar a origin atual
  if (import.meta.env.DEV) {
    return window.location.origin;
  }
  
  return publishedUrl;
};

// No statePayload:
redirect_url: `${getAppBaseUrl()}/scope-m365/tenant-connection`,
```

### 2. TenantEditDialog.tsx - Estrutura Base

```typescript
interface TenantEditDialogProps {
  tenant: TenantConnection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

Campos editáveis:
- `display_name` (text input)
- `tenant_domain` (text input, readonly se conectado)
- Botão salvar e cancelar

### 3. useTenantConnection.ts - Nova Função

```typescript
const updateTenant = async (tenantId: string, updates: { display_name?: string; tenant_domain?: string }) => {
  try {
    const { error } = await supabase
      .from('m365_tenants')
      .update(updates)
      .eq('id', tenantId);

    if (error) throw error;

    // Log audit
    await supabase.from('m365_audit_logs').insert({
      tenant_record_id: tenantId,
      user_id: user?.id,
      action: 'tenant_updated',
      action_details: updates,
    });

    await fetchTenants();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
```

### 4. TenantStatusCard.tsx - Botão de Edição

Adicionar entre os botões existentes:
```tsx
<Button 
  variant="outline" 
  size="sm"
  onClick={() => onEdit?.(tenant.id)}
  title="Editar tenant"
>
  <Pencil className="w-3 h-3" />
</Button>
```

---

## Ordem de Implementação

1. Corrigir URL de redirecionamento no `TenantConnectionWizard.tsx`
2. Adicionar função `updateTenant` no hook `useTenantConnection.ts`
3. Criar componente `TenantEditDialog.tsx`
4. Modificar `TenantStatusCard.tsx` para incluir botão de edição
5. Integrar tudo no `TenantConnectionPage.tsx`

---

## Resumo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│ TenantStatusCard                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│  │  Testar  │ │  Editar  │ │ Permiss. │ │Desconect.│ │ Excluir││
│  │          │ │  (NOVO)  │ │          │ │          │ │        ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘│
│                    │                                            │
│                    ▼                                            │
│            ┌───────────────┐                                    │
│            │TenantEditDialog│                                    │
│            │ - Display Name │                                    │
│            │ - Domain       │                                    │
│            │ [Salvar]       │                                    │
│            └───────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```
