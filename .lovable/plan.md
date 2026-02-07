

# Adicionar visualizacao de itens afetados nos cards de Postura M365

## Problema
Os cards de postura M365 mostram "X itens afetados" mas nao permitem clicar para ver quais sao. O modelo de dados ja possui `affectedEntities: AffectedEntity[]` com `displayName`, `userPrincipalName` e `details`, mas nao ha UI para exibi-los.

## Solucao

Criar um dialog para listar as entidades afetadas e tornar o texto "X itens afetados" clicavel no card.

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/m365/posture/M365AffectedEntitiesDialog.tsx` | **Criar** - Dialog com lista de entidades afetadas |
| `src/components/m365/posture/M365InsightCard.tsx` | **Modificar** - Tornar "itens afetados" clicavel para abrir o dialog |
| `src/components/m365/posture/index.ts` | **Modificar** - Exportar novo componente |

## Detalhes Tecnicos

### M365AffectedEntitiesDialog

Dialog que recebe o `M365Insight` e exibe:
- Header com codigo, severidade e titulo do insight
- Lista scrollavel das entidades afetadas (`affectedEntities`)
- Cada entidade mostra `displayName`, `userPrincipalName` e badges com `details`
- Mensagem de "e mais X entidade(s)" caso `affectedCount > affectedEntities.length`
- Segue o mesmo padrao visual do `InsightDetailDialog` e `ExoInsightDetailDialog` ja existentes

### M365InsightCard

Modificar a secao de "itens afetados" (linhas 117-122) para:
- Tornar o bloco clicavel (cursor pointer, hover state)
- Ao clicar, abrir o `M365AffectedEntitiesDialog`
- Adicionar estado `showAffected` para controlar a abertura do dialog

