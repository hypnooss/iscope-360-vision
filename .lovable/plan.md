
# Plano: Corrigir Salvamento de Credenciais e Validação de Permissões

## Diagnóstico

### Problema 1: Logs mostram endpoint antigo (`/domains`)
Os logs da Edge Function ainda mostram `Testing Graph API access with /domains endpoint...`. Isso indica que a alteração anterior para usar `/organization` **ainda não foi deployada** ou os logs são de execuções anteriores.

**Ação**: Fazer re-deploy da edge function `m365-oauth-callback`.

### Problema 2: Credenciais não salvas quando Graph API falha
O fluxo atual:
```text
OAuth Callback → Teste Graph API → FALHA → Retorna erro (NÃO salva credenciais)
```

Quando o teste da Graph API falha (por exemplo, devido à demora na propagação do Admin Consent), o callback **não salva as credenciais** na tabela `m365_app_credentials`. Resultado:
- O botão "Testar" falha com "Credenciais não encontradas"
- O usuário fica preso sem poder testar novamente

### Problema 3: Permissões não listadas (0/9)
A UI exibe 0/9 permissões porque:
- Não há registros em `m365_tenant_permissions` para este tenant
- Sem credenciais, a Edge Function `validate-m365-connection` não pode ser chamada

---

## Solução

### Parte 1: Salvar Credenciais Mesmo em Caso de Falha

Mover o salvamento de credenciais para **antes** do teste da Graph API, garantindo que o usuário possa usar o botão "Testar" posteriormente.

**Arquivo**: `supabase/functions/m365-oauth-callback/index.ts`

**Mudança**: Após obter o token com sucesso (linha ~317), salvar as credenciais imediatamente, antes de testar a Graph API.

### Parte 2: Verificar Deploy da Edge Function

A alteração de `/domains` para `/organization` já foi feita no código, mas os logs indicam que pode não ter sido deployada. Re-deploy é necessário para aplicar a correção.

---

## Detalhes Técnicos

### Alteração no fluxo do `m365-oauth-callback`

| Antes | Depois |
|-------|--------|
| Token OK → Teste Graph → Salva creds → Retorna sucesso | Token OK → **Salva creds** → Teste Graph → Atualiza status → Retorna resultado |
| Token OK → Teste Graph falha → Retorna erro (sem salvar) | Token OK → **Salva creds** → Teste Graph falha → Retorna erro (creds salvas) |

### Código a modificar

**Linha ~317-400**: Após obter o token, inserir o salvamento de credenciais:

```typescript
// APÓS obter token com sucesso (linha ~317)

// ===== NOVO: Salvar credenciais ANTES de testar Graph API =====
// Isso permite que o usuário use o botão "Testar" caso o teste inicial falhe
console.log('Saving credentials early to allow retry...');
const { error: earlyCredError } = await supabase
  .from('m365_app_credentials')
  .upsert({
    tenant_record_id,
    azure_app_id: appId,
    auth_type: 'multi_tenant_app',
    is_active: true,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'tenant_record_id',
  });

if (earlyCredError) {
  console.error('Failed to save early credentials:', earlyCredError);
  // Continue mesmo se falhar - não é crítico neste ponto
}

// Continua com o teste da Graph API...
```

**Linha ~686-700**: Atualizar para fazer upsert com sp_object_id (já está correto, mas agora será uma atualização em vez de insert).

---

## Resultado Esperado

### Fluxo corrigido:

```text
1. OAuth Callback recebe código
2. Obtém token de acesso ✓
3. SALVA CREDENCIAIS (novo!) ✓
4. Testa Graph API
   4a. Se OK → Atualiza status para 'connected', salva permissões
   4b. Se FALHA → Atualiza status para 'pending', redireciona com erro
5. Usuário pode clicar "Testar" mais tarde quando Admin Consent propagar
```

### Benefícios:

1. **Usuário pode testar novamente**: Após aguardar propagação do Admin Consent
2. **Visibilidade de permissões**: O botão "Testar" funcionará e populará a lista de permissões
3. **Melhor UX**: Sem mensagem confusa "Credenciais não encontradas"

---

## Resumo de Alterações

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/functions/m365-oauth-callback/index.ts` | EDIT | Salvar credenciais antes de testar Graph API |

## Re-deploy necessário

Após a alteração, a edge function será automaticamente re-deployada, aplicando também a correção anterior (`/domains` → `/organization`).
