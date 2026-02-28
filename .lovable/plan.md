

## Corrigir "Testar" e "Revalidar Permissoes" no M365TenantEditPage

### Problema 1: Botao "Testar" da erro

O `handleTest` chama `validate-m365-connection` com apenas `{ tenant_record_id: id }`. Porem, a edge function exige `tenant_id`, `app_id` e `client_secret` no body (retorna 400 se ausentes). O frontend nao tem acesso ao `client_secret` (criptografado no banco), entao a solucao e fazer a edge function buscar as credenciais do banco quando receber apenas `tenant_record_id`.

### Problema 2: Permissoes nao atualizam apos consent

Apos o popup de admin consent retornar, o `handleRevalidatePermissions` chama `validate-m365-permissions` para re-checar. Porem, essa funcao atualiza apenas a tabela `m365_global_config.validated_permissions` (validacao global). A tabela `m365_tenant_permissions` (que a UI le para exibir o grid de permissoes) NAO e atualizada por essa funcao. Quem atualiza `m365_tenant_permissions` e a funcao `validate-m365-connection` (linhas 649-669).

### Solucao

**Arquivo: `supabase/functions/validate-m365-connection/index.ts`**

Adicionar logica no inicio do handler para aceitar chamadas com apenas `tenant_record_id`:
- Se `tenant_id`, `app_id` ou `client_secret` estiverem ausentes mas `tenant_record_id` estiver presente:
  - Buscar `tenant_id` da tabela `m365_tenants` usando o `tenant_record_id`
  - Buscar `azure_app_id` da tabela `m365_app_credentials` usando o `tenant_record_id`
  - Buscar `client_secret_encrypted` da tabela `m365_global_config`
  - Usar esses valores para continuar a validacao normalmente
- Isso permite que tanto "Testar" quanto "Revalidar" funcionem com apenas o `tenant_record_id`

**Arquivo: `src/pages/environment/M365TenantEditPage.tsx`**

Alterar o callback pos-consent (useEffect com `waitingForConsent`) para chamar `validate-m365-connection` em vez de `validate-m365-permissions`:
- Enviar `{ tenant_record_id: id }` para `validate-m365-connection`
- Isso garante que a tabela `m365_tenant_permissions` seja atualizada com o status correto de cada permissao
- A UI reflete as mudancas imediatamente apos o `invalidateQueries`

### Fluxo corrigido

**Testar:**
1. Frontend envia `{ tenant_record_id: id }` para `validate-m365-connection`
2. Edge function busca credenciais do banco
3. Valida todas as permissoes via Graph API
4. Atualiza `m365_tenant_permissions` e `m365_tenants.connection_status`
5. Frontend atualiza a UI

**Revalidar Permissoes:**
1. Frontend chama `validate-m365-permissions` para checar se ha permissoes pendentes
2. Se houver, abre popup de admin consent do Azure
3. Apos retorno do popup, chama `validate-m365-connection` com `{ tenant_record_id: id }`
4. Edge function busca credenciais, testa permissoes, atualiza `m365_tenant_permissions`
5. Frontend atualiza o grid de permissoes (15/16 vira 16/16 se consent foi concedido)

### Mudancas necessarias

| Arquivo | Mudanca |
|---------|---------|
| `validate-m365-connection/index.ts` | Adicionar fallback para buscar credenciais do banco quando so `tenant_record_id` e fornecido |
| `M365TenantEditPage.tsx` | Trocar chamada pos-consent de `validate-m365-permissions` para `validate-m365-connection` |

### Deploy

Apos as mudancas, deploy da edge function `validate-m365-connection`.

