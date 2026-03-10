

## Correção: Frequência do M365 na página Ambiente

Na página `EnvironmentPage.tsx` linha 95, a query de agendamento dos tenants M365 busca da tabela `m365_analyzer_schedules`. Precisa trocar para `m365_compliance_schedules`, que é a tabela recém-criada para o módulo de Compliance.

### Alteração

**`src/pages/EnvironmentPage.tsx` (linha 95)**
- Trocar `m365_analyzer_schedules` → `m365_compliance_schedules`

Uma única linha.

