

# Retry com delay para atribuicao da role Exchange Administrator

## Problema

Na linha 681 do `m365-oauth-callback/index.ts`, a funcao `assignExchangeAdminRole` e chamada imediatamente apos o Admin Consent. Nesse momento, a permissao `RoleManagement.ReadWrite.Directory` ainda nao propagou no Entra ID, resultando em erro 403. Na segunda tentativa (via "Revalidar Permissoes"), a permissao ja propagou e funciona normalmente.

## Solucao

Adicionar logica de retry com backoff na chamada `assignExchangeAdminRole` (linhas 678-699), aguardando a propagacao da permissao antes de desistir.

## Detalhes tecnicos

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/m365-oauth-callback/index.ts` | Envolver a chamada `assignExchangeAdminRole` (linha 681) em um loop de retry com delays de 5s, 10s e 15s. Se o resultado for erro 403 / `Authorization_RequestDenied`, aguardar e tentar novamente. Manter o comportamento nao-bloqueante (nao impede a conexao se falhar apos todas as tentativas). |

### Logica de retry

```text
Tentativa 1: chamar assignExchangeAdminRole imediatamente
  Se 403 -> aguardar 5s
Tentativa 2: chamar assignExchangeAdminRole
  Se 403 -> aguardar 10s
Tentativa 3: chamar assignExchangeAdminRole
  Se 403 -> aguardar 15s
Tentativa 4 (final): chamar assignExchangeAdminRole
  Se falhar -> registrar como falha (comportamento atual)
```

Tempo maximo adicional: 30 segundos. Isso e aceitavel pois o usuario ja aguarda o retorno do fluxo OAuth e a funcao ja possui retry de ate 60s para o endpoint `/organization`.

### Modificacao na funcao assignExchangeAdminRole

Alterar o retorno de erro para incluir um campo `retryable: true` quando o erro for 403, permitindo que o caller saiba quando vale a pena tentar novamente.

### Modificacao no caller (linhas 678-699)

Substituir a chamada direta por um loop que verifica `roleResult.success` ou se o erro e retryable, aplicando os delays antes de cada nova tentativa.

