
# Plano: Validação de Permissões M365 Manual e Automática

## Situação Atual

### Problemas Identificados

1. **Botão "Validar Permissões"**: Usa `import.meta.env.VITE_SUPABASE_URL` que pode não funcionar corretamente. Deve usar a URL do Supabase hardcoded ou o cliente Supabase.

2. **Edge Function `validate-m365-permissions`**: Existe e está completa mas:
   - Não está declarada no `supabase/config.toml`
   - Não é chamada por nenhum cron job

3. **Cron Job**: As extensões `pg_cron` e `pg_net` não estão instaladas no banco de dados, impedindo a execução automática.

4. **Dados no banco**: `validation_tenant_id` está `null`, então a validação automática não funcionaria mesmo se o cron existisse.

## Solução

### 1. Corrigir o botão "Validar Permissões"

**Arquivo: `src/pages/admin/SettingsPage.tsx`**

Alterar a função `validatePermissions` para usar o cliente Supabase diretamente ao invés de `fetch` com `import.meta.env`:

```typescript
const validatePermissions = async () => {
  if (!tenantIdForValidation.trim()) {
    toast.error('Informe o Tenant ID para validar as permissões');
    return;
  }

  setValidatingPermissions(true);
  try {
    // Chamar a edge function validate-m365-permissions
    const { data, error } = await supabase.functions.invoke('validate-m365-permissions', {
      body: { tenant_id: tenantIdForValidation }
    });

    if (error) throw error;

    if (data.success && data.permissions) {
      setM365Config(prev => ({
        ...prev,
        permissions: data.permissions,
        permissionsValidated: true,
        lastValidatedAt: data.validatedAt,
        validationTenantId: tenantIdForValidation,
      }));
      toast.success('Permissões validadas com sucesso');
    } else if (data.skipped) {
      toast.info(data.message || 'Validação ignorada');
    } else {
      throw new Error(data.error || 'Erro desconhecido');
    }
  } catch (error) {
    console.error('Error validating permissions:', error);
    toast.error('Erro ao validar permissões');
  } finally {
    setValidatingPermissions(false);
  }
};
```

### 2. Atualizar Edge Function `validate-m365-permissions`

**Arquivo: `supabase/functions/validate-m365-permissions/index.ts`**

Modificar para:
- Aceitar `tenant_id` via body (para chamadas manuais) ou usar o salvo no banco (para cron)
- Salvar o `validation_tenant_id` quando passado manualmente
- Manter a lógica de alertas existente

```typescript
// No início do handler, após obter o body:
let tenantId = configData.validation_tenant_id;

// Verificar se foi passado via body (chamada manual)
try {
  const body = await req.json();
  if (body.tenant_id) {
    tenantId = body.tenant_id;
    // Atualizar o tenant_id no banco para futuras validações automáticas
    await supabase
      .from('m365_global_config')
      .update({ validation_tenant_id: tenantId })
      .eq('id', configData.id);
  }
} catch {
  // Body vazio é OK para chamadas automáticas via cron
}

if (!tenantId) {
  return new Response(
    JSON.stringify({ success: true, message: 'No validation tenant ID configured', skipped: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 3. Adicionar função ao config.toml

**Arquivo: `supabase/config.toml`**

Adicionar a declaração da função:

```toml
[functions.validate-m365-permissions]
verify_jwt = false
```

### 4. Habilitar extensões e criar Cron Job

**Migração SQL** para:
1. Habilitar `pg_cron` e `pg_net`
2. Criar o cron job para validação automática a cada hora

```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Agendar validação de permissões M365 a cada hora
SELECT cron.schedule(
  'm365-permissions-hourly',
  '0 * * * *',  -- A cada hora, no minuto 0
  $$
  SELECT net.http_post(
    url := 'https://akbosdbyheezghieiefz.supabase.co/functions/v1/validate-m365-permissions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrYm9zZGJ5aGVlemdoaWVpZWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2MTEyODAsImV4cCI6MjA4NTE4NzI4MH0.9n-nUenSCwYIGztsfgVAbgis9wEakQDKX3Oe2xBiNvo"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/SettingsPage.tsx` | Alterar `validatePermissions` para usar a edge function correta |
| `supabase/functions/validate-m365-permissions/index.ts` | Aceitar `tenant_id` via body e atualizar no banco |
| `supabase/config.toml` | Adicionar `validate-m365-permissions` |
| Nova migração SQL | Habilitar extensões e criar cron job |

## Fluxo Final

```text
┌─────────────────────────────────────────────────────────────┐
│                    VALIDAÇÃO MANUAL                          │
├─────────────────────────────────────────────────────────────┤
│  1. Usuário insere Tenant ID                                │
│  2. Clica "Validar Permissões"                              │
│  3. Frontend chama validate-m365-permissions                │
│  4. Function salva tenant_id + valida permissões            │
│  5. Salva resultados no banco + cria alertas se necessário  │
│  6. Frontend atualiza UI com resultados                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   VALIDAÇÃO AUTOMÁTICA                       │
├─────────────────────────────────────────────────────────────┤
│  1. pg_cron executa a cada hora                             │
│  2. Chama validate-m365-permissions via HTTP                │
│  3. Function usa tenant_id salvo anteriormente              │
│  4. Valida permissões e atualiza banco                      │
│  5. Cria/atualiza alertas se permissões falharem            │
└─────────────────────────────────────────────────────────────┘
```

## Resultado Esperado

1. **Botão funciona**: Ao clicar em "Validar Permissões", o sistema conecta ao Azure, testa cada permissão e mostra o resultado
2. **Tenant ID salvo**: O Tenant ID inserido é salvo no banco para validações futuras
3. **Validação automática**: A cada hora, o sistema verifica as permissões automaticamente
4. **Alertas**: Se permissões obrigatórias falharem, super_admins veem um alerta no sistema
