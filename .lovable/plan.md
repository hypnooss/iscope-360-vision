
## Corrigir botao "Revalidar Permissoes" que nao abre popup do Azure

### Problema raiz

O `handleRevalidatePermissions` no `M365TenantEditPage.tsx` tem 3 bugs na leitura da resposta da edge function `validate-m365-permissions`:

1. **Campo errado**: O codigo le `data?.results` mas a edge function retorna `data.permissions`
2. **Propriedade errada**: O codigo checa `r.status !== 'granted'` mas o retorno usa `r.granted` (boolean)
3. **Tipo errado**: O codigo checa `r.required` mas o retorno usa `r.type === 'required'`

Como `data?.results` e `undefined`, o `totalFailed` sempre resulta em `0`, e o fluxo cai no `if (totalFailed === 0)` mostrando "Todas as permissoes ja estao concedidas" sem abrir o popup.

Alem disso, a edge function nao aceita `tenant_record_id` - ela usa `tenant_id` diretamente do body ou da config global.

### Correcao

**Arquivo: `src/pages/environment/M365TenantEditPage.tsx`**

Linhas 171-186 - Corrigir a chamada e a leitura da resposta:

- Enviar `tenant_id: tenant.tenant_id` no body (em vez de `tenant_record_id`)
- Ler `data?.permissions` em vez de `data?.results`
- Checar `!r.granted` em vez de `r.status !== 'granted'`
- Checar `r.type === 'required'` em vez de `r.required`

```typescript
// ANTES (bugado):
const failedRequired = data?.results?.filter((r: any) => r.status !== 'granted' && r.required)?.length || 0;
const failedRecommended = data?.results?.filter((r: any) => r.status !== 'granted' && !r.required)?.length || 0;

// DEPOIS (corrigido):
const failedRequired = data?.permissions?.filter((r: any) => !r.granted && r.type === 'required')?.length || 0;
const failedRecommended = data?.permissions?.filter((r: any) => !r.granted && r.type === 'recommended')?.length || 0;
```

### Resultado esperado

1. Clicar em "Revalidar Permissoes" valida as permissoes no servidor
2. Se `IdentityRiskyUser.Read.All` (ou qualquer outra) estiver pendente, abre o popup do Azure para admin consent
3. Apos conceder no popup, revalida automaticamente e atualiza a UI
