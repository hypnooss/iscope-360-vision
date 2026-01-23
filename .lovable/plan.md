
# Plano: Corrigir Teste de Conexão e Adicionar Visualização de Permissões no Tenant

## Resumo dos Problemas Identificados

### Problema 1: Botão "Testar" não valida realmente a conexão

O código atual da função `testConnection` em `useTenantConnection.ts`:
```typescript
const testConnection = async (tenantId: string) => {
  // This would call an edge function to test the Graph API connection
  // For now, just update the last_validated_at timestamp  <-- PLACEHOLDER!
  try {
    const { error } = await supabase
      .from('m365_tenants')
      .update({ last_validated_at: new Date().toISOString() })
      .eq('id', tenantId);
    // ...
  }
};
```

A função apenas atualiza o timestamp, **sem chamar a edge function `validate-m365-connection`** que realmente:
- Obtém token de acesso
- Testa a API do Graph
- Valida cada permissão
- Atualiza o `connection_status` (pending/connected/partial/failed)

### Problema 2: Permissões não são exibidas no card do tenant

O `TenantStatusCard` não busca nem exibe as permissões do tenant (`m365_tenant_permissions`), mesmo que os dados existam no banco de dados.

Dados encontrados no banco para o tenant NEXTA:
| Permissão | Status |
|-----------|--------|
| User.Read.All | granted |
| Directory.Read.All | pending |
| Group.Read.All | granted |
| Application.Read.All | granted |
| AuditLog.Read.All | pending |

---

## Solução Proposta

### Parte 1: Corrigir o Teste de Conexão

**Arquivo**: `src/hooks/useTenantConnection.ts`

A função `testConnection` precisa:
1. Buscar as credenciais do tenant (app_id, client_secret)
2. Chamar a edge function `validate-m365-connection`
3. Retornar o resultado real da validacao

```typescript
const testConnection = async (tenantId: string) => {
  try {
    // 1. Buscar credenciais do tenant
    const { data: credentials, error: credError } = await supabase
      .from('m365_app_credentials')
      .select('app_id, client_secret_encrypted')
      .eq('tenant_record_id', tenantId)
      .single();
    
    if (credError || !credentials) {
      return { 
        success: false, 
        error: 'Credenciais nao encontradas. O tenant pode nao ter completado o consentimento.' 
      };
    }

    // 2. Buscar tenant_id (Azure) da tabela m365_tenants
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) {
      return { success: false, error: 'Tenant nao encontrado.' };
    }

    // 3. Chamar edge function para validar
    const { data, error } = await supabase.functions.invoke('validate-m365-connection', {
      body: {
        tenant_id: tenant.tenant_id,
        app_id: credentials.app_id,
        client_secret: credentials.client_secret_encrypted, // A edge function decripta
        tenant_record_id: tenantId,
      }
    });

    if (error) throw error;

    await fetchTenants();
    return { 
      success: data.success, 
      error: data.error,
      permissions: data.permissions,
    };
  } catch (err: any) {
    console.error('Error testing connection:', err);
    return { success: false, error: err.message };
  }
};
```

### Parte 2: Adicionar Visualizacao de Permissoes no Card

**Arquivo**: `src/components/m365/TenantStatusCard.tsx`

Adicionar seção de permissões similar à imagem de referência (Administração > Configurações):

1. Buscar permissões do tenant via prop ou query
2. Exibir em duas colunas: Obrigatórias e Opcionais/Recomendadas
3. Indicador visual (verde = granted, amarelo = pending)

**Nova prop** para receber permissões ou buscar internamente:
```typescript
interface TenantStatusCardProps {
  tenant: TenantConnection;
  permissions?: TenantPermission[]; // NOVO
  // ...
}
```

**Nova seção no card**:
```tsx
{permissions && permissions.length > 0 && (
  <div className="pt-2 border-t border-border/50">
    <div className="grid grid-cols-2 gap-4 text-xs">
      <div>
        <p className="text-muted-foreground mb-2">Obrigatórias</p>
        {requiredPerms.map(p => (
          <div key={p.name} className="flex items-center gap-1">
            <span className={cn("w-2 h-2 rounded-full", 
              p.status === 'granted' ? 'bg-green-500' : 'bg-amber-500'
            )} />
            <span>{p.permission_name}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="text-muted-foreground mb-2">Recomendadas</p>
        {/* Similar para opcionais */}
      </div>
    </div>
  </div>
)}
```

### Parte 3: Buscar Permissoes do Tenant

**Arquivo**: `src/hooks/useTenantConnection.ts`

Adicionar função para buscar permissões:
```typescript
const fetchTenantPermissions = async (tenantRecordId: string) => {
  const { data, error } = await supabase
    .from('m365_tenant_permissions')
    .select('*')
    .eq('tenant_record_id', tenantRecordId);
  
  return data || [];
};
```

Ou incluir na query principal de tenants via join.

### Parte 4: Atualizar Edge Function validate-m365-connection

A edge function precisa ser capaz de decriptar o `client_secret_encrypted` usando AES-GCM (similar à correção feita em `validate-m365-permissions`).

Atualmente, ela recebe o secret em texto plano, mas quando chamada do frontend com dados do banco, virá encriptado.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useTenantConnection.ts` | Implementar `testConnection` real com edge function + adicionar busca de permissões |
| `src/components/m365/TenantStatusCard.tsx` | Adicionar seção de permissões com indicadores visuais |
| `src/pages/m365/TenantConnectionPage.tsx` | Passar permissões como prop ou integrar busca |
| `supabase/functions/validate-m365-connection/index.ts` | Adicionar decriptação AES-GCM do client_secret |

---

## Resultado Esperado

Após as alterações:

1. **Testar Conexão**:
   - Realmente valida a conexão com a Microsoft Graph API
   - Atualiza o status do tenant (connected/partial/failed)
   - Atualiza as permissões na tabela `m365_tenant_permissions`

2. **Card do Tenant**:
   - Exibe lista de permissões em duas colunas
   - Indicador verde para permissões concedidas
   - Indicador amarelo para permissões pendentes
   - Visual consistente com a página de Configurações

---

## Diagrama do Fluxo Corrigido

```text
┌──────────────────┐     ┌─────────────────────────────┐
│  Clique "Testar" │────>│ testConnection()            │
└──────────────────┘     │ 1. Busca credentials        │
                         │ 2. Chama edge function      │
                         └────────────┬────────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────────┐
                         │ validate-m365-connection    │
                         │ 1. Decripta client_secret   │
                         │ 2. Obtém token OAuth        │
                         │ 3. Testa cada permissão     │
                         │ 4. Atualiza m365_tenants    │
                         │ 5. Atualiza permissions     │
                         └────────────┬────────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────────┐
                         │ Atualiza UI                 │
                         │ - Status: connected/partial │
                         │ - Exibe permissões          │
                         └─────────────────────────────┘
```
