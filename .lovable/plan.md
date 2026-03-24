

## Plano: Corrigir dados de MFA zerados no Entra ID Dashboard

### Diagnóstico

O endpoint `userRegistrationDetails` da Graph API com `$filter=userType eq 'member'` **requer** o header `ConsistencyLevel: eventual`. Sem ele, a API pode retornar resultados parciais ou vazios de forma intermitente.

Atualmente, `graphGetAllPages()` **não aceita headers customizados** — só passa `Authorization`. Isso faz com que a chamada de MFA (linha 155) funcione às vezes e falhe silenciosamente em outras, resultando em snapshots com `mfa.total: 0`.

O último snapshot salvo (carregado pelo frontend às 18:58) tinha 0 MFA users. Uma execução posterior (19:00) retornou 8 — mas 8 usuários num tenant com centenas ainda é muito baixo, confirmando que o endpoint não está devolvendo todos os registros sem o header.

### Solução

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/entra-id-dashboard/index.ts` | Adicionar parâmetro `headers` a `graphGetAllPages()` e passar `{ 'ConsistencyLevel': 'eventual' }` na chamada de `userRegistrationDetails` |

### Detalhe técnico

1. **Modificar `graphGetAllPages`** para aceitar headers opcionais e passá-los ao `graphGet` em cada página
2. **Atualizar a chamada MFA** (linha 155) para incluir `{ 'ConsistencyLevel': 'eventual' }` — necessário pela Graph API quando se usa `$filter` neste endpoint
3. **Aumentar `maxPages`** de 5 para 10 na chamada MFA, garantindo cobertura para tenants grandes (até ~10.000 usuários)

