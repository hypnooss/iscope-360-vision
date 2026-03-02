

## Diagnóstico — IdentityRiskEvent.Read.All continua pendente após Admin Consent

### Causa Raiz

Os logs confirmam que:
1. `ensure-exchange-permission` adicionou `IdentityRiskEvent.Read.All` ao manifesto às 02:48:56 ✅
2. Admin Consent foi completado com sucesso (oauth-callback executou às 02:52:27) ✅
3. Mas o token obtido via `client_credentials` retorna 403: *"required scopes are missing in the token"*

Isso é um **problema de propagação do Azure AD**. Quando uma nova permissão é adicionada ao manifesto e o Admin Consent é concedido imediatamente depois, o token emitido pelo Azure pode levar até 5 minutos para refletir o novo scope. Todos os três pontos de verificação (oauth-callback, validate-m365-permissions, validate-m365-connection) falham porque pegam o token "velho".

### Solução — Retry com novo token para permissões com "scopes missing"

Adicionar lógica de retry no `validate-m365-connection` para permissões que falham com a mensagem específica *"required scopes are missing in the token"*:

1. Na primeira passada, se uma permissão retorna 403 com "scopes are missing", marcar para retry
2. Após processar todas as permissões, se houver permissões marcadas para retry:
   - Aguardar 15 segundos
   - Obter um **novo** token (nova chamada client_credentials)
   - Retestar apenas as permissões que falharam
3. Se ainda falhar no retry, marcar como `pending` normalmente

Isso resolve o problema de propagação transparentemente, sem que o usuário precise revalidar manualmente várias vezes.

### Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `supabase/functions/validate-m365-connection/index.ts` | Adicionar lógica de retry com novo token para permissões com "scopes missing" |

### Detalhe de implementação

O retry será implementado no loop principal de verificação de permissões (linhas ~389-640). Quando o bloco `IdentityRiskEvent.Read.All` (ou qualquer permissão) detecta o erro "scopes are missing", a permissão é adicionada a uma lista de retry. Após o loop, se a lista não estiver vazia, o sistema aguarda 15s, obtém novo token, e retesta.

