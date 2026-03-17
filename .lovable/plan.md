
Problema confirmado: o Firewall Compliance tem histórico no banco, mas a tela mostra “Sem execução” e “0 execuções” para vários firewalls como BAU-FW, TRP-FW e SAO-FW.

O que verifiquei
- No banco existem tasks `fortigate_compliance` recentes para Firewall Compliance.
- Exemplos:
  - BAU-FW: última task em `2026-03-17 00:15`
  - TRP-FW: última task em `2026-03-17 01:15`
  - SAO-FW: última task em `2026-03-17 01:15`
- Portanto, o problema não é de agendamento nem ausência de dados. É da forma como a tela busca os dados.

Causa raiz
1. A aba de agendamentos faz uma busca global em `agent_tasks` para todos os tipos e todos os `target_id`.
2. Essa busca é ordenada por data decrescente, então os registros mais recentes de tasks horárias dominam o retorno.
3. Como o Firewall Compliance é diário, os registros dele ficam “para trás” e acabam não vindo no payload usado pela UI.
4. Resultado:
   - `latestTasks` não encontra a última execução do firewall diário e mostra “Sem execução”.
   - `taskHistory` fica sem os pontos da timeline e mostra “Nenhuma execução neste período”.

Plano de correção
1. Isolar o datasource do Firewall Compliance
   - Criar uma query dedicada só para `fortigate_compliance`.
   - Filtrar por:
     - `task_type = 'fortigate_compliance'`
     - `target_id in [ids dos firewalls da analysis_schedules]`
   - Não misturar essa leitura com Analyzer, M365, Domain ou Surface.

2. Corrigir a coluna “Última Execução” do Firewall Compliance
   - Montar um mapa `targetId -> task mais recente` a partir da query dedicada.
   - Usar esse mapa somente quando `schedule.targetType === 'firewall'`.

3. Corrigir a timeline expandida do Firewall Compliance
   - Alimentar o `ScheduleTimeline` com a query dedicada de compliance.
   - Assim cada linha expandida passa a exibir apenas os pontos do próprio `fortigate_compliance`.

4. Manter a lógica atual dos outros tipos por enquanto
   - Como você pediu para fazer por partes, vou mexer só no fluxo de Firewall Compliance.
   - Não altero ainda Domain, Surface, M365 ou Firewall Analyzer nessa rodada.

5. Ajuste de robustez
   - Evitar dependência de um fetch global que pode truncar dados por volume.
   - Se necessário, ampliar a janela só do Firewall Compliance ou paginar essa consulta específica, mas o principal é separar por `task_type`.

Arquivos envolvidos
- `src/pages/admin/SchedulesPage.tsx`

Resultado esperado após aplicar
- Firewall Compliance volta a mostrar:
  - badge correto em “Última Execução”
  - quantidade correta na timeline
  - pontos de execução em 24h / 48h / 7 dias
- Sem misturar dados do Analyzer.
- Sem ficar vazio mesmo quando existirem tasks no banco.

Detalhe técnico importante
Hoje o bug não é de filtro visual; é de estratégia de leitura. A tela está consultando `agent_tasks` de forma ampla demais. Como existem muitas tasks mais recentes de outros tipos, o conjunto retornado não contém várias tasks diárias de compliance. A correção certa é fazer uma consulta dedicada para `fortigate_compliance` e usar esse resultado especificamente nas linhas de Firewall Compliance.
