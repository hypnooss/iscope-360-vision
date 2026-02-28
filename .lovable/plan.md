

## Fix: Auto-descobrir Object ID em vez de usar valor manual

### Problema

O `app_object_id` configurado (`aad7eba1-63ae-4e33-8e8b-09ecbf159157`) continua retornando `ResourceNotFound`, mesmo com o token do home tenant correto. O valor fornecido nao e o Object ID real do App Registration no Azure.

### Solucao

Remover a dependencia do `app_object_id` e usar auto-descoberta via Graph API, exatamente como o `m365-oauth-callback` ja faz com sucesso:

```
GET https://graph.microsoft.com/v1.0/applications(appId='{client_id}')?$select=id,requiredResourceAccess
```

Isso retorna o Object ID real e ja traz o manifest atual em uma unica chamada.

### Mudancas

**Arquivo: `supabase/functions/ensure-exchange-permission/index.ts`**

1. Remover a checagem de `app_object_id` (linhas 107-113)
2. Apos obter o token do home tenant, fazer auto-discovery:
   - `GET /v1.0/applications(appId='{globalConfig.app_id}')?$select=id,requiredResourceAccess`
   - Extrair o `id` retornado como Object ID real
   - Extrair `requiredResourceAccess` na mesma chamada (elimina o segundo GET)
3. Usar o Object ID descoberto para o PATCH do manifest
4. Salvar o Object ID correto de volta em `m365_global_config` para referencia futura

### Fluxo corrigido

```text
1. Ler m365_global_config (app_id, client_secret, home_tenant_id)
2. Obter token do HOME tenant (Precisio)
3. GET /v1.0/applications(appId='{app_id}') -> descobre Object ID + manifest atual
4. Verificar permissoes faltantes no manifest
5. PATCH /v1.0/applications/{objectId_real} -> adiciona permissoes
6. UPDATE m365_global_config SET app_object_id = objectId_real
```

### Beneficio

Elimina totalmente a necessidade de configurar manualmente o Object ID. A funcao descobre o valor correto automaticamente a cada execucao.

