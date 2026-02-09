

# Corrigir contagem de severidades no cabeçalho da seção Exchange Online

## Problema

As contagens de severidade (crítico, alto, médio, baixo) no cabeçalho da categoria são calculadas apenas a partir dos itens com status `fail`. Itens com status `warn`/`warning` que também possuem severidade crítica ou alta são ignorados na contagem.

Exemplo: "Transport Rules Redirecionando para Externo" tem severidade **crítica** mas status `warn` — não é contado no badge "crítico" do cabeçalho.

## Solução

Alterar a base de cálculo das contagens de severidade para incluir **todos os itens não-conformes** (fail + warning + other), excluindo apenas os itens `pass`.

### Arquivo: `src/components/m365/exchange/ExchangeComplianceSection.tsx`

Linhas 52-55: Trocar `failedItems` por uma lista combinada de itens não-pass:

```text
// ANTES (só conta fail):
const criticalCount = failedItems.filter(i => i.severity === 'critical').length;

// DEPOIS (conta fail + warning + other):
const nonPassItems = items.filter(i => i.status !== 'pass');
const criticalCount = nonPassItems.filter(i => i.severity === 'critical').length;
const highCount = nonPassItems.filter(i => i.severity === 'high').length;
const mediumCount = nonPassItems.filter(i => i.severity === 'medium').length;
const lowCount = nonPassItems.filter(i => i.severity === 'low').length;
```

### Arquivo: `src/components/m365/posture/M365CategorySection.tsx`

Mesma correção nas linhas 59-62 para manter consistência entre as páginas Postura e Exchange Online.

## Arquivos afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/m365/exchange/ExchangeComplianceSection.tsx` | Contar severidade de todos os itens não-pass |
| `src/components/m365/posture/M365CategorySection.tsx` | Mesma correção para consistência |

