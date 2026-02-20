

# Badges de Severidade com Nome Completo

## Alteracao

No arquivo `src/components/surface/CategoryOverviewGrid.tsx`, trocar as abreviacoes das badges de severidade de formato curto (ex: `11C`, `4H`, `7M`, `1L`) para nome completo (ex: `11 Critical`, `4 High`, `2 Medium`, `1 Low`).

## Detalhe Tecnico

**Arquivo:** `src/components/surface/CategoryOverviewGrid.tsx`

Linhas ~90-95 — substituir o texto das badges:

| Antes | Depois |
|---|---|
| `{counts.critical}C` | `{counts.critical} Critical` |
| `{counts.high}H` | `{counts.high} High` |
| `{counts.medium}M` | `{counts.medium} Medium` |
| `{counts.low}L` | `{counts.low} Low` |

Nenhuma outra alteracao necessaria.

