
## Plano: Corrigir coleta de MFA do Entra ID Dashboard para todos os tenants do iSCOPE

### Diagnóstico validado ponta a ponta

Analisei o fluxo completo: frontend, hook, snapshots, edge function, analyzer e validação de permissões.

O problema não está em licença nem no frontend:

- O frontend só exibe o snapshot mais recente de `m365_dashboard_snapshots`
- Os snapshots recentes de vários tenants estão sendo gravados com `mfa.total = 0`
- Os logs da função confirmam isso:
  - tenants com problema: `MFA users: 0 raw → 0`
  - e existe erro real na chamada atual: `403` no endpoint com filtro
- O tenant atual (`88f2225c-...`) também está nessa condição
- Há um tenant específico (`9722ad79-...`) onde a chamada atual devolveu apenas `8` usuários, o que mostra comportamento inconsistente e subcontagem

### Causa raiz

Hoje o `entra-id-dashboard` usa:

```text
/reports/authenticationMethods/userRegistrationDetails?$filter=userType eq 'member'&$top=999
```

Esse é o ponto frágil.

O `m365-analyzer`, por outro lado, usa o mesmo endpoint **sem filtro server-side**:

```text
/reports/authenticationMethods/userRegistrationDetails?$top=999
```

e depois filtra `member` localmente.

Resultado:
- o dashboard usa a variante que está falhando com `403` / retorno vazio
- o analyzer usa a variante mais resiliente

### Conclusão arquitetural

O problema está no endpoint/estratégia da Edge Function do dashboard, não em:
- licença
- blueprint
- tela
- hook React
- banco

Importante: **blueprints não participam da coleta do `entra-id-dashboard`**. Essa função é hardcoded. Então mexer em blueprint não resolveria esse bug específico.

---

## O que vou alterar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/entra-id-dashboard/index.ts` | Remover o `$filter=userType eq 'member'` da chamada MFA |
| `supabase/functions/entra-id-dashboard/index.ts` | Aplicar a mesma filtragem local usada pelo analyzer: excluir guests e shared mailboxes no backend |
| `supabase/functions/entra-id-dashboard/index.ts` | Melhorar logs para separar: retorno bruto, members, guests, removidos por shared mailbox, e falha 403 |
| `supabase/functions/get-m365-config/index.ts` | Alinhar teste de `Reports.Read.All` com a forma real usada em produção |
| `supabase/functions/validate-m365-permissions/index.ts` | Mesmo alinhamento do teste de permissão |
| `supabase/functions/m365-oauth-callback/index.ts` | Padronizar validação do endpoint MFA para evitar falso “ok” em uma variante e falha em outra |

---

## Estratégia de implementação

1. **Trocar a coleta MFA do dashboard**
   - de:
     ```text
     userRegistrationDetails?$filter=userType eq 'member'&$top=999
     ```
   - para:
     ```text
     userRegistrationDetails?$top=999
     ```

2. **Filtrar localmente no backend**
   - excluir `guest`
   - excluir shared mailboxes por `UPN` e `DisplayName`
   - manter o mesmo padrão do `m365-analyzer`, para os dois fluxos produzirem números compatíveis

3. **Melhorar a observabilidade**
   - logar:
     - total bruto retornado pela Graph
     - quantos são `member`
     - quantos são `guest`
     - quantos foram removidos como shared mailbox
     - quantos ficaram na base final de MFA
   - isso evita novo “zero silencioso”

4. **Padronizar a validação de permissões**
   - hoje a validação de `Reports.Read.All` testa uma variação diferente da que o dashboard executa
   - vou alinhar isso para que o diagnóstico de permissão reflita o comportamento real da coleta

5. **Preservar contrato do frontend**
   - sem mudar estrutura de resposta
   - os cards e a sheet continuam consumindo:
     - `mfa.total`
     - `mfa.enabled`
     - `mfa.strong`
     - `mfa.weak`
     - `mfa.userDetails`

---

## Resultado esperado

Após a correção:

- os tenants do iSCOPE devem voltar a gravar snapshots com usuários em `mfa.userDetails`
- os cards “Cobertura MFA”, “MFA Forte”, “MFA Fraco” e “Sem MFA” deixam de mostrar `0/0`
- o comportamento do dashboard fica alinhado com o analyzer
- se a Graph falhar de novo, os logs vão deixar explícito onde ocorreu a quebra, em vez de persistir zero sem contexto

## Observação técnica importante

O principal indício objetivo é este:

```text
entra-id-dashboard -> endpoint com filtro -> 403 / vazio
m365-analyzer     -> endpoint sem filtro -> fluxo funcional
```

Então a mudança correta não é “tentar mais paginação” nem “mexer em licença”, e sim **parar de depender do filtro server-side nesse endpoint e replicar a filtragem no código**.
