
## Corrigir ensure-exchange-permission: usar home tenant para modificar App Registration

### Problema raiz

O `ensure-exchange-permission` obtém um token do `validation_tenant_id` (MOVECTA: `51415b39-...`) e tenta acessar o endpoint `GET /v1.0/applications(appId='...')`. Esse endpoint so retorna apps registrados **naquele** tenant. O app iScope 360 esta registrado no tenant da **Precisio** (`aa4c9de9-...`), por isso a API retorna `ResourceNotFound`.

O `validation_tenant_id` e usado para testar permissoes (precisa ser um tenant cliente com consent). Mas para modificar o manifest do App Registration, o token precisa ser do tenant onde o app foi criado ("home tenant").

### Solucao

1. **Adicionar coluna `home_tenant_id`** na tabela `m365_global_config` para armazenar o tenant onde o app esta registrado
2. **Atualizar os valores no banco**: `home_tenant_id = aa4c9de9-...` (Precisio) e `app_object_id = aad7eba1-...` (Object ID correto)
3. **Modificar `ensure-exchange-permission`** para usar `home_tenant_id` ao obter o token (em vez de `validation_tenant_id`)

### Mudancas

| Arquivo / Recurso | Mudanca |
|---|---|
| Migration SQL | Adicionar coluna `home_tenant_id` a `m365_global_config`, popular com `aa4c9de9-9a98-41f7-9aa0-bfd6401fc27c` e atualizar `app_object_id` para `aad7eba1-63ae-4e33-8e8b-09ecbf159157` |
| `ensure-exchange-permission/index.ts` | Ler `home_tenant_id` da config; usar esse tenant para obter o token; usar `app_object_id` diretamente (sem auto-discovery); fallback para `validation_tenant_id` se `home_tenant_id` nao existir |

### Fluxo corrigido

```text
1. Ler m365_global_config (app_id, app_object_id, client_secret, home_tenant_id)
2. Obter token do HOME tenant (Precisio) -> token pode acessar /applications
3. GET /applications/{app_object_id} -> le manifest atual
4. PATCH /applications/{app_object_id} -> adiciona permissoes faltantes
5. Admin consent popup agora mostra a permissao
```

### Detalhes tecnicos

Na edge function, a mudanca principal e:

```typescript
// Antes (errado - token do tenant cliente nao pode ler app registration)
const tenantForToken = globalConfig.validation_tenant_id;

// Depois (correto - token do home tenant pode modificar o app)
const tenantForToken = globalConfig.home_tenant_id || globalConfig.validation_tenant_id;
```

E usar `app_object_id` diretamente em vez de auto-discovery:

```typescript
const objectId = globalConfig.app_object_id;
const appUrl = `https://graph.microsoft.com/v1.0/applications/${objectId}`;
```
