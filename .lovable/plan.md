

## Chamar ensure-exchange-permission antes do popup de consent na revalidacao

### Problema

O fluxo de "Revalidar Permissoes" em `M365TenantEditPage.tsx` pula a etapa de atualizar o manifest do App Registration no Azure. Ele vai direto para o popup de admin consent, que so mostra as permissoes que ja estao no manifest. Como `IdentityRiskyUser.Read.All` nunca foi adicionada ao manifest (so existe na edge function `ensure-exchange-permission`), ela nunca aparece no popup.

A funcao `ensure-exchange-permission` e chamada em dois lugares:
- `AddM365TenantPage.tsx` (ao adicionar um novo tenant)
- `TenantConnectionWizard.tsx` (no wizard de conexao)

Mas **nunca** durante a revalidacao no `M365TenantEditPage.tsx`.

### Solucao

**Arquivo: `src/pages/environment/M365TenantEditPage.tsx`** (funcao `handleRevalidatePermissions`, linhas 172-238)

Adicionar chamada a `ensure-exchange-permission` **antes** de abrir o popup de admin consent:

```text
Fluxo atual:
1. validate-m365-permissions -> verifica quais faltam
2. Abre popup de admin consent (sem atualizar manifest)

Fluxo corrigido:
1. validate-m365-permissions -> verifica quais faltam
2. ensure-exchange-permission -> atualiza manifest com permissoes faltantes
3. Abre popup de admin consent (agora com todas as permissoes)
```

Inserir entre a checagem de permissoes pendentes e a abertura do popup (apos linha 191):

```typescript
// 1.5 Ensure all required permissions are in the App Registration manifest
try {
  await supabase.functions.invoke('ensure-exchange-permission');
} catch {
  // non-blocking - continue with consent even if manifest update fails
}
```

### Resultado

- Qualquer permissao nova adicionada ao array `REQUIRED_PERMISSIONS` em `ensure-exchange-permission/index.ts` sera automaticamente incluida no manifest antes do popup de consent
- O popup de admin consent mostrara "Read all risky user information" (IdentityRiskyUser.Read.All)
- Apos o consent, a validacao retornara 16/16

### Mudanca

| Arquivo | Mudanca |
|---------|---------|
| `M365TenantEditPage.tsx` | Adicionar chamada a `ensure-exchange-permission` antes de abrir o popup de admin consent |

