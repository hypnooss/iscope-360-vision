

# Corrigir Contagem de Severidades para Firewall e Dominio Externo

## Diagnostico

Os cards de Firewall e Dominio Externo mostram "Nenhum alerta" porque o hook `useDashboardStats` busca severidades em `report_data.summary` -- mas esse campo **nao existe** nesses modulos. 

- **M365**: Tem `m365_posture_history.summary = {critical: 1, high: 0, ...}` (funciona)
- **Firewall**: `analysis_history.report_data` tem apenas `categories` com regras individuais, sem `summary`
- **External Domain**: `external_domain_analysis_history.report_data` tem apenas `categories`, sem `summary`

A solucao e computar as severidades percorrendo as regras dentro de `report_data.categories`, contando itens com `status != 'pass'` agrupados por `severity`.

## Alteracao

### Arquivo: `src/hooks/useDashboardStats.ts`

Criar uma funcao utilitaria que extrai severidades de `report_data`:

```text
function extractSeveritiesFromCategories(reportData):
  Se reportData.summary existir -> retornar summary (compatibilidade)
  Se reportData.categories existir:
    Para cada categoria em categories:
      Para cada regra na categoria:
        Se regra.status != 'pass':
          Incrementar contagem de regra.severity (critical/high/medium/low)
    Retornar contagens
  Retornar zeros
```

Aplicar esta funcao nos blocos de Firewall (linha ~112) e External Domain (linha ~182), substituindo o acesso direto a `report.summary`.

### Logica de contagem

Cada regra no `report_data.categories` possui:
- `status`: `pass`, `fail`, `warn`, `unknown`
- `severity`: `critical`, `high`, `medium`, `low`

Contabilizar como alerta: qualquer regra com `status` diferente de `pass`.

## Detalhes tecnicos

A funcao sera adicionada antes do hook e reutilizada nos dois blocos (firewall e external domain). O bloco M365 continua usando `summary` diretamente, pois ja funciona.

## Arquivos modificados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useDashboardStats.ts` | Adicionar funcao `extractSeveritiesFromReport` e usa-la nos blocos de Firewall e External Domain |

