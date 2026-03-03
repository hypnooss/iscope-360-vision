

## Diagnóstico

O problema **não** é que duas tasks são criadas ao clicar "Executar Análise". É um **bug de label** na tela de Execuções (`M365ExecutionsPage.tsx`).

### O que acontece

1. Ao clicar "Executar Análise" no M365 Compliance, são criados:
   - 1 registro em `m365_posture_history` (aparece como "M365 Compliance" — correto)
   - 1 `agent_task` com `task_type: 'm365_powershell'` (coleta PowerShell para o Compliance)

2. Na tela de Execuções, **ambos** aparecem porque a página lista tanto `m365_posture_history` quanto `agent_tasks`.

3. O `typeConfig` mapeia `m365_powershell` → label **"M365 Analyzer"** (errado). Deveria ser **"M365 Compliance (Agent)"** ou similar.

4. Além disso, a linha 291 mapeia **qualquer** `task_type` que não seja `m365_graph_api` para `m365_powershell`, incluindo tasks reais do tipo `m365_analyzer`. Isso perde a distinção.

### Correções

**Arquivo: `src/pages/m365/M365ExecutionsPage.tsx`**

1. **Adicionar `m365_analyzer` ao `typeConfig`** com label e cor distintos
2. **Renomear o label de `m365_powershell`** de "M365 Analyzer" para "M365 Compliance (Agent)"
3. **Corrigir o mapeamento na linha 291** para preservar o `task_type` original (`m365_powershell`, `m365_analyzer`, `m365_graph_api`) em vez de colapsar tudo para `m365_powershell`
4. **Atualizar o tipo `UnifiedExecution.type`** para incluir `m365_analyzer`

