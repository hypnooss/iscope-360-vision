

## Fix: Timeline sem dados + Adicionar timeline na aba Execuções

### Problema raiz
A query `taskHistory` retorna 5.000 registros ordenados por `created_at ASC`. Com **11.014 tasks** nos últimos 7 dias, os ~6.000 mais recentes são descartados. A view padrão (24h) mostra "Nenhuma execução" porque os dados recentes nunca chegam ao frontend.

### Correções em `src/pages/admin/SchedulesPage.tsx`

#### 1. Corrigir query do taskHistory
- Mudar order para `descending` para priorizar dados recentes
- No componente `ScheduleTimeline`, reverter a ordem para exibição cronológica (`.slice().reverse()`)
- Isso garante que as últimas 24h/48h sempre tenham dados, mesmo com >5000 tasks

#### 2. Adicionar timeline expansível na aba Execuções
- Agrupar execuções por `target_id` na aba Execuções
- Adicionar coluna de expansão (chevron) igual à aba Agendamentos
- Reutilizar o componente `ScheduleTimeline` já existente
- A query de histórico já existe — reutilizar `taskHistory` ou criar uma similar para a aba Execuções

**Na prática:** A aba Execuções já lista tasks individuais. A timeline será adicionada como linha expansível abaixo de cada execução, mostrando o histórico do mesmo `target_id` nas últimas 24h/48h/7d — exatamente como na aba Agendamentos.

### Resumo das mudanças

| Mudança | Local |
|---------|-------|
| Order `desc` + reverse no render | `taskHistory` query + `ScheduleTimeline` |
| Expansão + timeline na aba Execuções | `ExecutionsTab` component |

