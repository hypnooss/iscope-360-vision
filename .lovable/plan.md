
# Plano: Adicionar Reports.Read.All na Lista de Permissões

## Contexto

A permissão `Reports.Read.All` é necessária para a análise de segurança do Entra ID (verificar taxas de adoção de MFA, métodos de autenticação registrados, etc). Esta permissão precisa ser exibida na tela de Configurações para que o administrador saiba que deve adicioná-la no Azure Portal.

## Alteração

Adicionar `Reports.Read.All` à lista de permissões recomendadas na página de Configurações.

### Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/SettingsPage.tsx` | Adicionar `Reports.Read.All` na lista `defaultPermissions` |

### Código Atual (linha 55-64)

```typescript
const defaultPermissions: PermissionStatus[] = [
  { name: 'User.Read.All', granted: false, type: 'required' },
  { name: 'Directory.Read.All', granted: false, type: 'required' },
  { name: 'Organization.Read.All', granted: false, type: 'required' },
  { name: 'Domain.Read.All', granted: false, type: 'required' },
  { name: 'Group.Read.All', granted: false, type: 'recommended' },
  { name: 'Application.Read.All', granted: false, type: 'recommended' },
  { name: 'Policy.Read.All', granted: false, type: 'recommended' },
  { name: 'RoleManagement.Read.Directory', granted: false, type: 'recommended' },
];
```

### Código Atualizado

```typescript
const defaultPermissions: PermissionStatus[] = [
  { name: 'User.Read.All', granted: false, type: 'required' },
  { name: 'Directory.Read.All', granted: false, type: 'required' },
  { name: 'Organization.Read.All', granted: false, type: 'required' },
  { name: 'Domain.Read.All', granted: false, type: 'required' },
  { name: 'Group.Read.All', granted: false, type: 'recommended' },
  { name: 'Application.Read.All', granted: false, type: 'recommended' },
  { name: 'Policy.Read.All', granted: false, type: 'recommended' },
  { name: 'Reports.Read.All', granted: false, type: 'recommended' },
  { name: 'RoleManagement.Read.Directory', granted: false, type: 'recommended' },
];
```

## Resultado

Após a alteração, a permissão `Reports.Read.All` aparecerá na seção "Recomendadas" da tela de Configurações do Microsoft 365, junto com as outras permissões. Isso garante que:

1. O administrador veja que precisa adicionar essa permissão no Azure Portal
2. A validação de permissões possa verificar se essa permissão foi concedida
3. A análise de segurança do Entra ID funcione corretamente com relatórios de MFA
