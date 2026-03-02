

## Plano: Unificação da Tolerância de Permissões + Retry Automático em Background

### Diagnóstico Confirmado

Após análise detalhada das 3 edge functions (~2700 linhas combinadas):

- **`validate-m365-connection`** (1034 linhas): Tolerância completa — trata 403 Forbidden (NonPremiumTenant, UnknownError, Forbidden), 400 (service disabled), 412 (app-only), 404 (beta) + retry com fresh token para "scopes missing"
- **`m365-oauth-callback`** (856 linhas): Tolerância **ZERO** nas linhas 485-523 — usa `testResponse.ok` puro sem nenhum tratamento de erros de licenciamento. Salva como "pending" tudo que retorna 403
- **`validate-m365-permissions`** (860 linhas): Tolerância **PARCIAL** nas linhas 459-486 — trata 400/412/403-NonPremiumTenant mas NÃO trata 403-Forbidden genérico, 403-UnknownError, 404-beta, nem faz retry

O fluxo atual: `oauth-callback` salva permissões com status incorreto → `validate-m365-connection` roda depois via postMessage mas os dados "sujos" já estão no banco.

### Estratégia (3 partes)

---

**Parte 1 — Aplicar tolerância unificada no `m365-oauth-callback`**

Nas linhas 485-523 do `m365-oauth-callback`, onde os testes de permissão genéricos são executados com `testResponse.ok` sem nenhuma tolerância, adicionar a mesma lógica de tolerância do `validate-m365-connection`:

```text
Se status 400 + "not applicable" ou "service principal disabled" → granted
Se status 412 → granted  
Se status 403 + NÃO contém "missing application roles":
  - NonPremiumTenant, license, Forbidden, UnknownError → granted
  - Security endpoints sem "insufficient privileges" → granted
Se status 404 em endpoint beta → granted
```

Isso faz com que o `oauth-callback` salve os mesmos resultados que o `validate-m365-connection` salvaria depois.

**Arquivos**: `supabase/functions/m365-oauth-callback/index.ts`

---

**Parte 2 — Aplicar mesma tolerância no `validate-m365-permissions`**

A função `testPermission` (linhas 198-491) já trata 400/412/403-NonPremiumTenant, mas falta:
- 403 Forbidden genérico (sem "missing roles") em endpoints de segurança
- 403 UnknownError
- 404 em beta endpoints

Atualizar o bloco de tratamento de erro (linhas 453-486) para incluir a mesma lógica.

**Arquivos**: `supabase/functions/validate-m365-permissions/index.ts`

---

**Parte 3 — Retry automático no frontend (background polling)**

Alterar `M365TenantEditPage.tsx` para, após o retorno do consent popup:

1. Rodar `validate-m365-connection` (já faz isso)
2. Se ainda houver permissões pendentes, iniciar um **polling automático** que:
   - Chama `validate-m365-connection` a cada 20 segundos
   - Mostra na UI: "Aguardando propagação do Azure AD... (tentativa 2/9)"
   - Para quando: todas as permissões estão granted, OU após 3 minutos (9 tentativas)
   - Se expirar, mostra toast: "Algumas permissões ainda estão pendentes. O Azure AD pode levar até 5 minutos para propagar."

O usuário clica **uma única vez** em "Revalidar Permissões" e o sistema cuida de tudo automaticamente.

**Arquivos**: `src/pages/environment/M365TenantEditPage.tsx`

---

### Resumo das Mudanças

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `m365-oauth-callback/index.ts` | Adicionar lógica de tolerância nos testes de permissão genéricos (linhas 485-523) | Elimina falsos "pending" no momento do consent |
| `validate-m365-permissions/index.ts` | Alinhar tolerância do `testPermission` com `validate-m365-connection` | Consistência na pré-validação |
| `M365TenantEditPage.tsx` | Adicionar polling automático pós-consent com retry de 20s por até 3 min | UX de "um clique" confiável |

Requer deploy de 2 edge functions.

