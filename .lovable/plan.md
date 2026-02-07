
# Plano: Substituir Application.ReadWrite.OwnedBy por Application.ReadWrite.All

## Resumo

Atualizar a validação e monitoramento de permissões M365 para usar `Application.ReadWrite.All` em vez de `Application.ReadWrite.OwnedBy`, refletindo a nova configuração no Azure.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/validate-m365-permissions/index.ts` | Atualizar permissão no array e no switch case |
| `src/pages/admin/SettingsPage.tsx` | Atualizar permissão nos arrays e na UI |
| `supabase/functions/register-agent/index.ts` | Atualizar mensagem de erro |

---

## Mudanças Detalhadas

### 1. Edge Function `validate-m365-permissions/index.ts`

**Linha 34** - Atualizar array de permissões:
```typescript
// ANTES
const CERTIFICATE_PERMISSIONS = [
  'Application.ReadWrite.OwnedBy',
];

// DEPOIS
const CERTIFICATE_PERMISSIONS = [
  'Application.ReadWrite.All',
];
```

**Linhas 130-153** - Atualizar case no switch:
```typescript
// ANTES
case 'Application.ReadWrite.OwnedBy': {

// DEPOIS
case 'Application.ReadWrite.All': {
```

---

### 2. Frontend `SettingsPage.tsx`

**Linha 99** - Atualizar permissão inicial:
```typescript
// ANTES
{ name: 'Application.ReadWrite.OwnedBy', granted: false, type: 'recommended' },

// DEPOIS
{ name: 'Application.ReadWrite.All', granted: false, type: 'recommended' },
```

**Linha 106** - Atualizar array de agrupamento:
```typescript
// ANTES
const certificatePermissions = ['Application.ReadWrite.OwnedBy'];

// DEPOIS
const certificatePermissions = ['Application.ReadWrite.All'];
```

**Linha 842** - Atualizar texto exibido na UI:
```typescript
// ANTES
Application.ReadWrite.OwnedBy

// DEPOIS
Application.ReadWrite.All
```

---

### 3. Edge Function `register-agent/index.ts`

**Linha 182** - Atualizar mensagem de erro:
```typescript
// ANTES
return { success: false, error: 'Permission denied. Ensure Application.ReadWrite.OwnedBy permission is granted.' };

// DEPOIS
return { success: false, error: 'Permission denied. Ensure Application.ReadWrite.All permission is granted.' };
```

---

## Impacto

- **Validação**: A permissão `Application.ReadWrite.All` será testada no lugar de `OwnedBy`
- **Monitoramento**: Alertas de permissões ausentes refletirão a nova permissão
- **UI**: A página de configurações mostrará `Application.ReadWrite.All` na seção de Upload de Certificados
- **Mensagens de Erro**: Orientações sobre permissões faltantes mencionarão a permissão correta

---

## Resultado Esperado

Após o deploy:

1. A validação de permissões testará `Application.ReadWrite.All`
2. A UI mostrará o nome correto da permissão
3. O próximo heartbeat do agent (que já está configurado para usar PATCH) deve conseguir fazer upload do certificado com sucesso
