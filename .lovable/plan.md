
# Plano: Adicionar ensure-exchange-permission ao botão "Reconsentir"

## Alteração Necessária

**Arquivo**: `src/pages/m365/TenantConnectionPage.tsx`

Na função `handleUpdatePermissions` (linhas 217-280), adicionar chamada ao `ensure-exchange-permission` **antes** de abrir a URL de Admin Consent.

## Código Atual (linhas 217-266)

```typescript
const handleUpdatePermissions = async (tenantId: string) => {
  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) return;

  try {
    // Get M365 App config to build Admin Consent URL
    const { data: configData, error: configError } = await supabase.functions.invoke('get-m365-config', {
      body: {},
    });

    // ... monta URL e abre popup ...
  }
};
```

## Código Atualizado

```typescript
const handleUpdatePermissions = async (tenantId: string) => {
  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) return;

  try {
    // NOVO: Garantir que Exchange.ManageAsApp está no App Registration
    const { error: ensureError } = await supabase.functions.invoke('ensure-exchange-permission');
    if (ensureError) {
      console.warn('Could not ensure Exchange permission:', ensureError);
      // Não bloqueia - continua com o consent
    }

    // Get M365 App config to build Admin Consent URL
    const { data: configData, error: configError } = await supabase.functions.invoke('get-m365-config', {
      body: {},
    });

    // ... resto do código permanece igual ...
  }
};
```

## Resultado

Ao clicar em "Reconsentir":
1. Sistema adiciona `Exchange.ManageAsApp` ao App Registration (se não existir)
2. Abre Admin Consent URL
3. Admin consente todas as permissões (incluindo Exchange)
4. CBA funciona

## Resumo

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/m365/TenantConnectionPage.tsx` | Adicionar chamada `ensure-exchange-permission` em `handleUpdatePermissions` |
