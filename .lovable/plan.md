

## Correção: Status "Parcial" causado por permissões duplicadas com nomes diferentes

### Causa Raiz

Após o loop dinâmico do banco de dados (que testa `Exchange.ManageAsApp` e `Sites.FullControl.All`), o código nas linhas 690-700 adiciona **mais duas entradas** ao `permissionResults` com nomes diferentes:
- `Exchange.ManageAsApp` (do DB) + `Exchange Administrator` (hardcoded) 
- `Sites.FullControl.All` (do DB) + `SharePoint Administrator` (hardcoded)

Esses testes de App Role Assignment frequentemente falham (Resource SP not found em alguns tenants). Como `allPermissionsGranted` usa `permissionResults.every(p => p.granted)` na linha 791, qualquer falha — mesmo de uma permissão opcional duplicada — marca o tenant como "partial".

### Solução

Duas mudanças na linha 791 de `validate-m365-connection/index.ts`:

1. **Mudar a lógica de `allPermissionsGranted`** para considerar apenas permissões **obrigatórias** (`required: true`):
```ts
const allPermissionsGranted = permissionResults
  .filter(p => p.required)
  .every(p => p.granted);
```

2. Se **todas as obrigatórias** passaram, status = `connected`. Se alguma obrigatória falhou, status = `partial`.

Isso é consistente com o propósito: permissões opcionais (como Exchange.ManageAsApp, Sites.FullControl.All, Application.ReadWrite.All) não devem bloquear o status de conexão.

### Arquivo
- `supabase/functions/validate-m365-connection/index.ts` — alterar linha 791

