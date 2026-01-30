
Objetivo
- Ajustar “Domínio Externo > Relatórios” para listar análises concluídas e permitir abrir um relatório detalhado (página) que mostre “resultado das coletas vs regras de compliance”, baseado no padrão já existente em “Firewall > Relatórios”.
- Você escolheu:
  - Fonte dos relatórios: Nova tabela de histórico
  - Visualização do relatório: Abrir página de detalhe
  - PDF: Não por enquanto

Estado atual (diagnóstico rápido)
- `src/pages/external-domain/ExternalDomainReportsPage.tsx` hoje está “stub”: não busca nada do Supabase (TODO) e os botões “Visualizar/Baixar PDF” só mostram toast.
- `src/pages/firewall/FirewallReportsPage.tsx` já implementa:
  - listagem via `analysis_history` (campos leves)
  - filtros por cliente/device
  - carregamento sob demanda de `report_data`
  - “Visualizar” navega para a página `FirewallAnalysis` passando `state: { report }`
- Backend (Edge Function) `supabase/functions/agent-task-result/index.ts` hoje:
  - Processa compliance rules apenas para `task.target_type === 'firewall'`
  - Para `external_domain`, apenas salva `agent_tasks.result` (rawData) e atualiza `external_domains.last_scan_at`
  - Ou seja: hoje não existe “histórico de compliance” (score + checks) para domínios externos.

O que será entregue
1) Banco: tabela de histórico para Domínio Externo
- Criar tabela `public.external_domain_analysis_history` com colunas análogas a `analysis_history`, mas referenciando `external_domains`:
  - `id uuid primary key default gen_random_uuid()`
  - `domain_id uuid not null references external_domains(id) on delete cascade`
  - `score integer not null`
  - `report_data jsonb not null` (versão “leve”: score + checks + categories + system_info, etc.)
  - `analyzed_by uuid null references auth.users(id)`
  - `created_at timestamptz not null default now()`
- Criar índices:
  - `(domain_id, created_at desc)` para acelerar listagem/detalhe.
- RLS:
  - SELECT: “Users can view history of accessible external domains” usando `has_client_access(auth.uid(), d.client_id)` via join `external_domains d`.
  - INSERT: espelhar o padrão do firewall (permitir inserir quando usuário tem acesso ao client do domínio; idealmente condicionar também a permissão `external_domain` edit/full, como já é feito em outras tabelas).
  - Sem UPDATE/DELETE (igual ao histórico do firewall), opcionalmente permitir service_role gerenciar tudo.

2) Backend: gerar complianceResult e gravar no histórico (External Domain)
- Ajustar `supabase/functions/agent-task-result/index.ts` para também processar compliance rules quando `task.target_type === 'external_domain'`:
  - Determinar `device_type_id` via `device_types` com `code = 'external_domain' and is_active = true`.
  - Buscar regras em `compliance_rules` para esse `device_type_id` (`is_active = true`).
  - Reusar o mesmo motor existente `processComplianceRules(rawData, rules)`.
  - Persistência:
    - Atualizar `external_domains`:
      - `last_scan_at = now()`
      - `last_score = score` (hoje esse campo existe mas não está sendo preenchido para domínio)
    - Inserir em `external_domain_analysis_history`:
      - `domain_id = task.target_id`
      - `score`
      - `report_data = historyReportData` (versão leve sem `raw_data`, seguindo a ideia usada no firewall)
- Observação importante (compatibilidade com modo progressivo):
  - A função já reconstrói `rawData` a partir de `task_step_results` quando `body.result` não vem no payload. Isso atende o módulo Domínio Externo, então o motor de compliance vai funcionar sobre `rawData` no formato `{ [step_id]: step.data }`.

3) Frontend: Relatórios (listagem) para Domínio Externo, baseado no Firewall > Relatórios
- Ajustar `src/pages/external-domain/ExternalDomainReportsPage.tsx` para:
  - Buscar histórico em `external_domain_analysis_history` (campos leves: `id, domain_id, score, created_at`)
  - Buscar domínios em `external_domains` (`id, name, domain, client_id`)
  - Buscar clientes em `clients` (`id, name`)
  - Montar filtros (Cliente/Domínio) e agrupar por domínio, exatamente como o firewall faz por firewall.
  - Botão “Visualizar”:
    - Buscar `report_data` sob demanda em `external_domain_analysis_history` (somente quando o usuário clica)
    - Navegar para a nova página de detalhe passando `state: { report, analysisMeta }`
- Remover/ocultar por enquanto o botão “Baixar PDF” (você pediu “Não por enquanto”):
  - Ou remover completamente, ou manter desabilitado com tooltip “Em breve”.

4) Frontend: Página de detalhe do relatório (Domínio Externo)
- Criar uma nova página, por exemplo:
  - `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` (nome pode ser ajustado)
- Rota sugerida (consistente com firewall):
  - `/scope-external-domain/domains/:id/report/:analysisId` (ou mais simples: `/scope-external-domain/domains/:id/report`)
- Comportamento:
  - Se `location.state.report` existir, renderiza direto (igual ao FirewallAnalysis faz).
  - Se não existir (ex: refresh do navegador), busca:
    - domínio em `external_domains` (para cabeçalho: name/domain)
    - `report_data` em `external_domain_analysis_history` filtrando por `analysisId` (ou por `domain_id` pegando o último se não tiver analysisId)
  - UI:
    - Reaproveitar os componentes existentes: `ScoreGauge`, `StatCard`, `CategorySection`, `ComplianceCard`.
    - Criar um “header card” específico para domínio (em vez de firewall URL/apiKey), mostrando:
      - Nome do domínio (name)
      - Domínio (domain)
      - Cliente (opcional, se buscar client)
      - Data do relatório (created_at)
    - Exibir:
      - Score geral
      - Totais: checks, passed, failed, warnings
      - Lista por categoria (CategorySection + ComplianceCard)
- Normalização do report:
  - Reaproveitar a lógica de `normalizeReportData` do `FirewallAnalysis.tsx` (idealmente extraindo para um util compartilhado, para não duplicar; se não, duplicar inicialmente e depois refatorar).

5) Rotas e navegação
- Atualizar `src/App.tsx` para incluir a nova rota da página de detalhe.
- Garantir que o breadcrumb em relatórios de Domínio Externo fique:
  - Domínio Externo > Relatórios > [nome do domínio] (ou “Análise”)

6) Tipagem do Supabase
- Como o projeto usa `src/integrations/supabase/types.ts` (gerado), após criar a tabela/migração será necessário atualizar os tipos para incluir:
  - `external_domain_analysis_history` (Row/Insert/Update/Relationships)
- Sem isso, o TS vai reclamar ao usar `supabase.from('external_domain_analysis_history')`.

Sequência de implementação (ordem recomendada)
1. Banco (migração): criar `external_domain_analysis_history` + índices + RLS.
2. Edge Function `agent-task-result`: calcular compliance para external_domain + gravar histórico + atualizar `external_domains.last_score`.
3. Frontend: implementar fetch real e ações em `ExternalDomainReportsPage`.
4. Frontend: criar a nova página de detalhe do relatório e adicionar rota no `App.tsx`.
5. Ajustes finais: breadcrumbs, estados de loading/empty, mensagens, e validação E2E manual.

Critérios de aceite (o que você poderá validar)
- Ao executar uma análise de domínio (fluxo já existente), após conclusão:
  - `external_domains.last_scan_at` é atualizado
  - `external_domains.last_score` é preenchido
  - Um registro aparece em `external_domain_analysis_history`
- Em “Domínio Externo > Relatórios”:
  - A lista mostra domínios com quantidade de análises
  - Filtros por cliente e domínio funcionam
  - Selecionar uma data/análise muda score exibido na linha
  - “Visualizar” abre a página de detalhe e mostra categorias/checks (comparação contra compliance_rules)
- Recarregar a página de detalhe (F5) ainda funciona (buscando do banco).

Riscos/atenções
- O motor de rules depende do formato do `rawData` (principalmente no modo progressivo: step_id -> data). Se alguma regra estiver esperando caminhos diferentes, alguns checks podem ficar como “fail/pending”. Se isso acontecer, ajustaremos `evaluation_logic` das regras (no banco) ou um “adapter” de normalização do rawData antes do `processComplianceRules`.
- RLS: precisamos garantir que as policies da nova tabela espelhem o acesso por client (para não “sumir” com dados na UI).
