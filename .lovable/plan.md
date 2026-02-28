

## Corrigir auto-descoberta do Object ID no ensure-exchange-permission

### Problema raiz

O campo `app_object_id` na tabela `m365_global_config` contem o valor errado (`6104db4c-fd2c-4faf-bd6a-e43f388ecf98`), que e o **Application (Client) ID** e nao o **Object ID** do App Registration no Azure. O endpoint da Graph API `GET /v1.0/applications/{id}` exige o Object ID, resultando em `Request_ResourceNotFound`.

### Solucao

Em vez de depender de um campo configurado manualmente (sujeito a erro), a edge function `ensure-exchange-permission` vai **auto-descobrir** o Object ID usando o `app_id` (Client ID) que ja esta correto na config. Essa e a mesma abordagem usada com sucesso no `m365-oauth-callback`.

### Mudancas

**Arquivo: `supabase/functions/ensure-exchange-permission/index.ts`**

1. Remover a checagem obrigatoria de `app_object_id` (linhas 97-103)
2. Apos obter o access token, auto-descobrir o Object ID via:
   ```
   GET https://graph.microsoft.com/v1.0/applications(appId='{globalConfig.app_id}')?$select=id
   ```
3. Usar o Object ID retornado pela API para o PATCH do manifest
4. Opcionalmente salvar o Object ID correto de volta em `m365_global_config` para uso futuro por outras funcoes

### Fluxo corrigido

```text
1. Ler m365_global_config (app_id, client_secret, validation_tenant_id)
2. Obter access token via client_credentials
3. GET /v1.0/applications(appId='{app_id}') -> descobre Object ID real
4. GET /v1.0/applications/{objectId} -> le manifest atual
5. PATCH /v1.0/applications/{objectId} -> adiciona permissoes faltantes
6. (Opcional) UPDATE m365_global_config SET app_object_id = objectId correto
```

### Beneficios

- Elimina a possibilidade de erro humano ao configurar o Object ID
- Funciona automaticamente para qualquer permissao nova adicionada ao array `REQUIRED_PERMISSIONS`
- Corrige o problema atual sem precisar que o usuario va ao Azure Portal copiar um ID

### Detalhes tecnicos

| Arquivo | Mudanca |
|---------|---------|
| `ensure-exchange-permission/index.ts` | Auto-descoberta do Object ID via Graph API usando `app_id`, remover dependencia do campo `app_object_id` |

