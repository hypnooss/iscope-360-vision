

## Diagnóstico: A função não foi deployada com o código atualizado

### Evidência dos logs

Os logs da execução das 15:57 mostram claramente:

```text
Permission check complete: 16/16 granted
Missing permissions: none
```

O bloco de permissões adicionais (linhas 718-779 do código fonte) **nunca foi executado**. Se tivesse sido, o log mostraria `28/28` ou `X/28`. Isso confirma que a versão deployada da Edge Function `validate-m365-connection` **não contém o código das 12 permissões adicionais**.

### Fluxo completo verificado

```text
1. UI (M365TenantEditPage) → chama validate-m365-connection
2. Edge Function testa permissões → grava em m365_tenant_permissions
3. UI lê m365_tenant_permissions → exibe 16/28 (só existem 16 registros)
```

O código está correto no repositório. O problema é exclusivamente de **deploy**.

### Ação necessária

1. **Re-deploy** da Edge Function `validate-m365-connection` para que a versão com as 12 permissões adicionais entre em produção
2. Após o deploy, o usuário clica em "Revalidar Permissões" e o sistema testará 28 permissões, gravando todas em `m365_tenant_permissions`

### Arquivos a alterar
Nenhum arquivo precisa ser editado — apenas o re-deploy da função `validate-m365-connection`.

