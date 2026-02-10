

# Corrigir Scope Filtering e Erros Graph API no M365

## Problema 1: Agent task criada desnecessariamente para scope `entra_id`

O `trigger-m365-posture-analysis` sempre cria uma agent task quando o tenant tem agent vinculado, independentemente do scope. Para `entra_id`, nao existe blueprint com `executor_type: 'hybrid'` ou `'agent'` -- toda a coleta e via Graph API (Edge Function). O agent recebe a task e executa 18 steps de Exchange desnecessariamente.

**Correcao:** No `trigger-m365-posture-analysis`, antes de criar a agent task, verificar se existem blueprints com `executor_type IN ('agent', 'hybrid')` que correspondam ao scope solicitado. Se nao houver, pular a criacao da task.

```text
trigger-m365-posture-analysis/index.ts (linhas ~111-160)

ANTES:
  if (tenantAgent?.agent_id) {
    // Sempre cria agent task
  }

DEPOIS:
  if (tenantAgent?.agent_id) {
    // Verificar se o scope requer coleta via agent
    const needsAgent = await checkScopeNeedsAgent(supabaseAdmin, scope);
    if (needsAgent) {
      // Criar agent task
    } else {
      console.log('Scope does not require agent, skipping task creation');
    }
  }
```

A funcao `checkScopeNeedsAgent` consulta `device_blueprints` para o device type M365 com `executor_type IN ('agent', 'hybrid')` e verifica se o nome do blueprint corresponde ao scope (ex: scope `exchange_online` -> blueprint com nome contendo "Exchange").

## Problema 2: Erros 403/400 da Graph API nao geram insights `not_found`

Atualmente, quando um step da Graph API falha com 403 (permissao ausente) ou 400 (endpoint invalido), o `evaluateRule` na funcao `m365-security-posture` retorna um insight com status `pass` e mensagem generica "Dados nao disponiveis". Isso e enganoso -- deveria ser `not_found`.

**Correcao:** Na funcao `evaluateRule` (linha ~204-207), quando o step tem erro, retornar status `not_found` em vez de `pass`. Isso requer uma pequena alteracao no tipo de retorno para suportar o status adicional.

```text
m365-security-posture/index.ts (linhas ~204-207)

ANTES:
  if (stepResult.error) {
    return createInsight(rule, 'pass', 0, [], 
      rule.not_found_description || 'Dados nao disponiveis', now, stepResult.stepId);
  }

DEPOIS:
  if (stepResult.error) {
    // Determinar se e erro de permissao/licenca
    const isPermissionError = stepResult.error.includes('403') || 
                              stepResult.error.includes('Forbidden');
    const isBadRequest = stepResult.error.includes('400') || 
                         stepResult.error.includes('Bad Request');
    
    const detail = isPermissionError
      ? 'Permissao insuficiente para acessar este recurso'
      : isBadRequest
        ? 'Endpoint nao suportado neste tenant'
        : 'Dados nao disponiveis';
    
    return createNotFoundInsight(rule, 
      rule.not_found_description || detail, now, stepResult.stepId);
  }
```

A nova funcao `createNotFoundInsight` gera um insight com `status: 'not_found'` e `severity: 'info'`, garantindo que apareca na UI como neutro (cinza) em vez de pass (verde).

## Problema 3: Scope filtering no `m365-security-posture` nao cobre `entra_id`

O filtro de blueprints na linha 686-688 so trata `exchange_online`. Precisa tambem tratar `entra_id` e outros scopes futuros.

**Correcao:** Expandir o filtro para mapear scope -> nome de blueprint e categorias.

```text
m365-security-posture/index.ts (linhas ~686-708)

// Mapa de scope para filtros
const scopeConfig: Record<string, { blueprintPattern: string; categories: string[] }> = {
  exchange_online: { 
    blueprintPattern: '%Exchange%', 
    categories: ['email_exchange', 'threats_activity', 'pim_governance'] 
  },
  entra_id: { 
    blueprintPattern: '%Entra%', 
    categories: ['identities', 'auth_access', 'admin_privileges', 'apps_integrations'] 
  },
};

if (blueprint_filter && scopeConfig[blueprint_filter]) {
  const cfg = scopeConfig[blueprint_filter];
  blueprintQuery = blueprintQuery.ilike('name', cfg.blueprintPattern);
  rulesQuery = rulesQuery.in('category', cfg.categories);
}
```

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/trigger-m365-posture-analysis/index.ts` | Verificar se scope requer agent antes de criar task |
| `supabase/functions/m365-security-posture/index.ts` | Scope filtering para `entra_id`; insights `not_found` para erros 403/400 |

## Resultado esperado

- Analise com scope `entra_id` nao cria agent task desnecessaria
- Steps Graph API com erro 403 geram insights "Nao Encontrado" (cinza) em vez de "Pass" (verde)
- Filtragem correta de blueprints e regras para Entra ID (apenas categorias relevantes)
- Contagem consistente de insights mesmo com permissoes ausentes

