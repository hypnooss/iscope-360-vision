

# Correção: Mail.Read e MailboxSettings.Read mostram "Pendente" incorretamente

## Problema Raiz

Os logs revelam o erro real:
```
MailboxNotEnabledForRESTAPI
```

Isso acontece porque o teste pega o **primeiro usuário** da lista (`$top=1`), e esse usuário nao tem mailbox Exchange habilitada (pode ser conta de servico, shared mailbox, ou usuario sem licenca Exchange). O erro 404 com `MailboxNotEnabledForRESTAPI` **nao significa falta de permissao** — significa que a permissao esta concedida mas o usuario testado nao tem mailbox.

A logica correta seria:
- **403 Forbidden** = permissao NAO concedida
- **404 MailboxNotEnabledForRESTAPI** = permissao concedida, usuario sem mailbox

## Solucao

Modificar os testes de `MailboxSettings.Read` e `Mail.Read` em **3 edge functions** para:

1. Tentar o primeiro usuario
2. Se receber `MailboxNotEnabledForRESTAPI`, tentar mais usuarios (ate 5)
3. Se TODOS os usuarios retornarem `MailboxNotEnabledForRESTAPI`, considerar a permissao como **concedida** (pois o erro nao e 403)
4. Somente marcar como "nao concedida" se receber 403 (Forbidden)

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/functions/validate-m365-connection/index.ts` | Atualizar testes de MailboxSettings.Read e Mail.Read |
| `supabase/functions/validate-m365-permissions/index.ts` | Mesma logica para o cron de validacao |
| `supabase/functions/m365-oauth-callback/index.ts` | Mesma logica para o callback OAuth |

## Logica do Teste (Pseudocodigo)

```text
Para MailboxSettings.Read e Mail.Read:

1. Buscar ate 5 usuarios: GET /users?$top=5&$select=id
2. Para cada usuario:
   a. Testar endpoint (mailboxSettings ou messageRules)
   b. Se 200 → permissao concedida (parar)
   c. Se 404 com MailboxNotEnabledForRESTAPI → continuar proximo usuario
   d. Se 403 → permissao NAO concedida (parar)
3. Se todos usuarios deram MailboxNotEnabledForRESTAPI:
   → Considerar permissao CONCEDIDA (erro e de mailbox, nao de permissao)
```

## Detalhes Tecnicos

### validate-m365-connection/index.ts (linhas 288-331)

Substituir os blocos `MailboxSettings.Read` e `Mail.Read` para:
- Buscar 5 usuarios em vez de 1
- Iterar tentando cada usuario
- Analisar o corpo da resposta de erro para identificar `MailboxNotEnabledForRESTAPI`
- Se todos falharem com esse erro, marcar como `granted = true`

### validate-m365-permissions/index.ts

Aplicar a mesma logica nos casos `MailboxSettings.Read` e `Mail.Read` do switch/case da funcao `testPermission`.

### m365-oauth-callback/index.ts

Aplicar a mesma logica no loop de teste de permissoes do callback OAuth.

