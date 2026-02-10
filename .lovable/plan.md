
# Transformar a pagina Entra ID no mesmo modelo da Exchange Online

## Objetivo

Substituir a pagina hub atual do Entra ID (com cards de navegacao para sub-paginas) por uma pagina de insights diretos com compliance sections, identica a Exchange Online. Os dados virao do snapshot mais recente da tabela `m365_posture_history`, filtrados pelo produto `entra_id`.

## Categorias Entra ID

As categorias de risco relevantes ao produto Entra ID sao:

- `identities` - Identidades
- `auth_access` - Autenticacao e Acesso
- `admin_privileges` - Privilegios Administrativos
- `apps_integrations` - Aplicacoes e Integracoes

## Alteracoes

### 1. Criar hook `useEntraIdInsights` (novo arquivo)

**Arquivo:** `src/hooks/useEntraIdInsights.ts`

Clone do `useExchangeOnlineInsights.ts` com as seguintes diferencas:
- Interface `EntraIdInsight` com `product: 'entra_id'`
- Constante `ENTRA_ID_CATEGORIES`: `['identities', 'auth_access', 'admin_privileges', 'apps_integrations']`
- Filtro por `product === 'entra_id'` ou categoria no array acima
- Fallback de legado: IDs comecando com `IDT-`, `AUT-`, `ADM-`, `APP-`
- Scope de analise: `scope: 'entra_id'` ao disparar `trigger-m365-posture-analysis`
- Mapper de categorias legadas adaptado para Entra ID

### 2. Reescrever pagina `EntraIdPage` 

**Arquivo:** `src/pages/m365/EntraIdPage.tsx`

Substituir o hub de cards pelo modelo da Exchange Online:
- Usar `useEntraIdInsights` para buscar dados
- Summary cards com contadores de severidade (usando `ExoInsightSummaryCards` renomeado ou clone)
- Botao "Reanalisar" que chama `triggerAnalysis`
- Tenant selector com badge "Conectado" e data da ultima analise
- Sections por categoria usando `ExchangeComplianceSection` (componente generico, funciona para qualquer categoria)
- Mapper `mapExchangeAgentInsight` reutilizado (ja e generico, apenas ajustar product)
- Estados: sem tenant, loading, erro, vazio, com dados
- Icone do header: `Shield` em vez de `Mail`

### 3. Criar mapper `mapEntraIdAgentInsight`

**Arquivo:** `src/lib/complianceMappers.ts`

Adicionar funcao identica a `mapExchangeAgentInsight` mas com `product: 'entra_id'` e `source: 'graph'`.

### 4. Criar `EntraIdInsightSummaryCards`

**Arquivo:** `src/components/m365/entra-id/EntraIdInsightSummaryCards.tsx`

Clone do `ExoInsightSummaryCards` com icone `Shield` em vez de `Mail` no card "Total de Insights".

### 5. Ajustar rotas (manter sub-paginas existentes)

As sub-paginas existentes (`/scope-m365/entra-id/analysis`, `/scope-m365/entra-id/security-insights`, `/scope-m365/entra-id/applications`) permanecem como estao. A rota `/scope-m365/entra-id` agora mostra insights diretamente em vez do hub.

## Resumo tecnico

| Arquivo | Acao |
|---------|------|
| `src/hooks/useEntraIdInsights.ts` | Novo - clone do useExchangeOnlineInsights adaptado |
| `src/pages/m365/EntraIdPage.tsx` | Reescrever - substituir hub por pagina de insights |
| `src/lib/complianceMappers.ts` | Adicionar `mapEntraIdAgentInsight` |
| `src/components/m365/entra-id/EntraIdInsightSummaryCards.tsx` | Novo - summary cards com icone Shield |

## Resultado esperado

A pagina Entra ID tera a mesma experiencia visual da Exchange Online: summary cards de severidade no topo, seguidos por sections colapsaveis por categoria (Identidades, Autenticacao, Privilegios, Aplicacoes), cada uma contendo cards de conformidade unificados com status pass/fail/warning/not_found.
