
# Corrigir Perda de Insights por Analises Escopadas

## Problema

Os hooks `useEntraIdInsights` e `useExchangeOnlineInsights` sempre buscam o **unico registro mais recente** com status `completed` na tabela `m365_posture_history`. Porem, analises escopadas (scope `entra_id` ou `exchange_online`) geram registros separados contendo apenas os insights daquele produto.

Dados atuais no banco para o tenant selecionado:

```text
1. 202075e6 (12:41) -> insights: 0, agent_insights: 14 (Exchange)
2. b1478eba (12:40) -> insights: 25 (Entra ID), agent_insights: 0
```

Quando a analise do Exchange (mais recente) completa, ambos os hooks leem o registro `202075e6`, que nao tem dados de Entra ID. Resultado: Entra ID mostra 0 insights. O inverso tambem ocorre.

## Solucao

Modificar ambos os hooks para buscar o registro mais recente **que contenha insights relevantes para o produto**, em vez de simplesmente o mais recente.

### Hook `useExchangeOnlineInsights`

Buscar os N registros mais recentes e iterar ate encontrar um que contenha insights de Exchange (por produto ou categoria). Se nenhum tiver, usar o mais recente (comportamento atual).

```text
// Em vez de limit(1), buscar ultimos 5 registros
.limit(5)

// Iterar para encontrar o primeiro com insights relevantes
for (const record of records) {
  const allInsights = [...(record.insights || []), ...(record.agent_insights || [])];
  const hasExchange = allInsights.some(i => 
    i.product === 'exchange_online' || 
    EXCHANGE_CATEGORIES.includes(i.category) ||
    i.id?.startsWith('exo_')
  );
  if (hasExchange) {
    // Usar este registro
    break;
  }
}
```

### Hook `useEntraIdInsights`

Mesma logica, filtrando por insights de Entra ID:

```text
for (const record of records) {
  const allInsights = [...(record.insights || []), ...(record.agent_insights || [])];
  const hasEntraId = allInsights.some(i => 
    i.product === 'entra_id' || 
    ENTRA_ID_CATEGORIES.includes(i.category) ||
    i.id?.startsWith('IDT-') || i.id?.startsWith('AUT-') ||
    i.id?.startsWith('ADM-') || i.id?.startsWith('APP-')
  );
  if (hasEntraId) {
    // Usar este registro
    break;
  }
}
```

### Consideracao sobre `analyzedAt`

O campo `analyzedAt` deve refletir a data do registro que realmente contem os dados exibidos, nao a data da analise mais recente (que pode ser de outro produto).

## Arquivos afetados

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useExchangeOnlineInsights.ts` | Buscar ultimo registro com insights de Exchange |
| `src/hooks/useEntraIdInsights.ts` | Buscar ultimo registro com insights de Entra ID |

## Resultado esperado

- Exchange Online sempre exibe insights do ultimo registro que contenha dados de Exchange
- Entra ID sempre exibe insights do ultimo registro que contenha dados de Entra ID
- Analises escopadas nao "apagam" os dados do outro produto na interface
