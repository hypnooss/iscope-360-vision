
# Plano: Corrigir Exibição de Permissões M365 Vazias

## Problema Identificado

A tabela `m365_global_config` contém:
```
validated_permissions: []  (array vazio)
last_validated_at: null
validation_tenant_id: null
```

O código JavaScript trata arrays vazios como truthy:
```javascript
// Linha 204 - SettingsPage.tsx
permissions: data.permissions || defaultPermissions

// Linha 313 - get-m365-config/index.ts
let permissions = savedPermissions || defaultPermissions;
```

Como `[]` é truthy em JavaScript, o fallback para `defaultPermissions` nunca é acionado quando o array está vazio.

## Solução

### Opção 1 (Recomendada): Corrigir a lógica de fallback

Alterar a verificação para considerar arrays vazios:

**Arquivo: `src/pages/admin/SettingsPage.tsx`**
```typescript
// Linha 204 - antes:
permissions: data.permissions || defaultPermissions,

// Linha 204 - depois:
permissions: (data.permissions && data.permissions.length > 0) ? data.permissions : defaultPermissions,

// Repetir para linhas 185, 198, 215, 220
```

**Arquivo: `supabase/functions/get-m365-config/index.ts`**
```typescript
// Linha 286-290 - adicionar verificação de length
if (configData?.validated_permissions && 
    Array.isArray(configData.validated_permissions) && 
    configData.validated_permissions.length > 0) {
  savedPermissions = configData.validated_permissions as PermissionStatus[];
  // ...
}

// Linha 313 - já estará correto pois savedPermissions será null
```

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/SettingsPage.tsx` | Corrigir 5 ocorrências do fallback de permissions |
| `supabase/functions/get-m365-config/index.ts` | Corrigir verificação do array de permissions |

## Resultado Esperado

Após a correção:
1. Quando `validated_permissions` estiver vazio, o sistema usará `defaultPermissions`
2. As permissões obrigatórias e recomendadas aparecerão na interface (em amarelo, indicando não validadas)
3. O usuário poderá então clicar em "Validar Permissões" para verificar o status real

## Testes de Validação

1. Acessar Administração → Configurações → Microsoft 365
2. Verificar se as permissões obrigatórias e recomendadas aparecem na lista
3. Clicar em "Validar Permissões" com um Tenant ID válido
4. Confirmar que os indicadores mudam de amarelo para verde após validação bem-sucedida
