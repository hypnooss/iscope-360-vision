

## Bug: Timeline vazia para Surface Analyzer, Domain Compliance e Firewall Compliance

### Causa raiz

Dois problemas nos mapeamentos de `task_type` introduzidos na correção anterior:

1. **`external_domain_compliance` não existe** — o tipo real no banco é `external_domain_analysis`. O mapeamento `TASK_TYPE_TO_TARGET` e `TARGET_TO_TASK_TYPES` usam o nome errado, então o filtro nunca encontra match e a timeline fica vazia.

2. **`attack_surface_scan` não existe em `agent_tasks`** — as tarefas de Surface Analyzer usam a tabela separada `attack_surface_tasks`, não `agent_tasks`. Então o filtro por esse tipo nunca retornará resultados.

3. **`latestTasks` exclui `attack_surface`** — a query na linha 433 filtra `target_type IN ['firewall', 'external_domain', 'm365_compliance', 'm365_tenant']`, omitindo completamente qualquer task de attack surface (que aliás nem está nessa tabela).

Valores reais do enum `agent_task_type`:
- `fortigate_compliance` ✅
- `fortigate_analyzer` ✅  
- `external_domain_analysis` (NÃO `external_domain_compliance`)
- `m365_powershell`, `m365_analyzer` ✅
- Não existe `attack_surface_scan`

### Correção

**1. Corrigir os mapeamentos (linhas 197-216):**

```
TASK_TYPE_TO_TARGET:
  external_domain_compliance → external_domain_analysis
  attack_surface_scan → (remover, não existe)

TARGET_TO_TASK_TYPES:
  external_domain: ['external_domain_analysis']  (era 'external_domain_compliance')
  attack_surface: []  (não tem tasks em agent_tasks)
```

**2. Surface Analyzer — buscar da tabela correta:**

Para o Surface Analyzer, a timeline precisa buscar dados de `attack_surface_tasks` (onde `snapshot_id` referencia snapshots do `client_id`), não de `agent_tasks`. Adicionar uma query dedicada para buscar o histórico de tasks da tabela `attack_surface_tasks` quando existirem schedules de attack_surface, e passar esses dados para o `ScheduleTimeline`.

**3. Firewall Compliance — provavelmente funciona, mas verificar:**

O `fortigate_compliance` já está mapeado corretamente. Se não está mostrando dados, pode ser que os dados não existam no período selecionado, ou o `target_id` não está batendo. Vou verificar durante a implementação.

### Arquivos alterados

- `src/pages/admin/SchedulesPage.tsx` — corrigir mapeamentos e adicionar query para `attack_surface_tasks`

