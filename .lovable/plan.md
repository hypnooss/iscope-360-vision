

## Garantir abas Análise, Evidências e Dados na sheet lateral do M365 Compliance

### Problemas identificados

1. **"Análise Efetuada" não aparece**: No `mapM365Insight`, o campo `details` não é preenchido. Como `description` recebe `descricaoExecutiva` (mesmo valor que `contextualMessage`), a condição no `ComplianceDetailSheet` (linha 203) nunca é satisfeita.

2. **Aba "Evidências" não aparece**: `mapM365Insight` não popula `evidence`. Os dados de `insight.evidencias` e `insight.affectedEntities` existem mas não são convertidos para `EvidenceItem[]`.

3. **Aba "Dados" incompleta**: `mapM365Insight` não mapeia `rawData`. O campo `insight.evidencias` contém os dados brutos que poderiam alimentar `rawData`.

### Alterações

**Arquivo 1: `src/lib/complianceMappers.ts` — função `mapM365Insight`**

- Adicionar `details` mapeado de `insight.riscoTecnico` ou de `insight.descricaoExecutiva` para garantir que "Análise Efetuada" apareça. Mais precisamente, usar a `descricaoExecutiva` como `details` (análise efetuada) e os textos de status como `description`/`failDescription`.
- Adicionar `evidence` construído a partir de `insight.affectedEntities` (mesmo padrão dos mappers de Exchange/Security: label "Itens afetados" + "Entidades afetadas").
- Adicionar `rawData` mapeado de `insight.evidencias` quando presente (objeto com chave `evidencias`).

**Arquivo 2: `src/components/compliance/ComplianceDetailSheet.tsx`**

- Alterar a lógica de `hasEvidence` e `hasAdminData` para garantir visibilidade:
  - A aba "Evidências" deve aparecer sempre que houver `evidence` com itens OU `affectedEntities` com itens (mesmo sem evidence formal, listar affected entities).
  - A aba "Dados" deve considerar `role === 'super_suporte'` além de `super_admin` (já está correto via `canViewAdminDetails`).
  - Garantir que a condição de "Análise Efetuada" não seja tão restritiva: exibir sempre que `details` existir, independente de ser igual ao `contextualMessage`.

### Arquivos a editar
1. `src/lib/complianceMappers.ts` — enriquecer `mapM365Insight` com `details`, `evidence` e `rawData`
2. `src/components/compliance/ComplianceDetailSheet.tsx` — ajustar condição de exibição de "Análise Efetuada" e aba "Evidências" para incluir affected entities

