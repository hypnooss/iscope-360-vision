
Objetivo (confirmado)
- Implementar “Domínio Externo > Relatórios” para listar análises concluídas e permitir abrir um relatório detalhado (página) mostrando “resultado das coletas vs regras de compliance”, reaproveitando o padrão de “Firewall > Relatórios”.
- Fonte: nova tabela `external_domain_analysis_history` (já criada).
- Visualização: abrir página de detalhe.
- PDF: não implementar agora.

Estado atual (o que já existe)
- Banco: `public.external_domain_analysis_history` já criada com índice e RLS.
- Frontend:
  - `src/pages/external-domain/ExternalDomainReportsPage.tsx` já tem layout e agrupamento, mas não busca dados reais e os botões ainda são “stub”.
  - Rotas em `src/App.tsx` ainda não têm rota para uma página de detalhe de relatório de domínio.
- Backend:
  - `supabase/functions/agent-task-result/index.ts` calcula compliance e grava histórico apenas para `firewall`.
  - Para `external_domain`, hoje salva `rawData` em `agent_tasks.result` e atualiza `external_domains.last_scan_at`, mas NÃO calcula score/checks nem grava em `external_domain_analysis_history`.
- Observação: o aviso “Leaked Password Protection Disabled” será ignorado conforme você pediu (não bloqueia este trabalho).

Implementação (o que eu vou mudar)

1) Backend — calcular compliance para external_domain e gravar histórico
Arquivo: `supabase/functions/agent-task-result/index.ts`

1.1. Estender a lógica que hoje roda apenas quando `task.target_type === 'firewall'` para também rodar quando `task.target_type === 'external_domain'`:
- Condição: `(body.status === 'completed' || body.status === 'partial') && rawData`
- Resolver `deviceTypeId`:
  - Para firewall: mantém como está.
  - Para external_domain: buscar em `device_types` com `code = 'external_domain'` e `is_active = true`.
- Buscar regras de compliance em `compliance_rules` com `device_type_id = deviceTypeId` e `is_active = true`.
- Reusar `processComplianceRules(rawData, rules)` (o motor já existe dentro dessa função).

1.2. Persistir resultados para external_domain:
- Atualizar `external_domains` quando status completed/partial:
  - `last_scan_at = now()`
  - `last_score = complianceResult.score`
- Inserir em `external_domain_analysis_history`:
  - `domain_id = task.target_id`
  - `score = complianceResult.score`
  - `report_data = historyReportData` (versão leve, sem `raw_data`, mesma ideia do firewall)
  - `analyzed_by = null` (a edge function não tem o usuário final; e a policy service_role permite inserir)
- Manter o comportamento atual de salvar `agent_tasks.result` com `rawData` para external_domain (isso continua útil para a tela de Execuções).

1.3. Logging e tratamento de erros
- Logs claros para:
  - Identificar quando processou regras de external_domain
  - Quantidade de regras aplicadas
  - Sucesso/erro ao inserir em `external_domain_analysis_history`
- Se falhar em gravar histórico, não quebrar o update do `agent_tasks` (o registro do resultado do task continua sendo prioridade).

2) Frontend — “Domínio Externo > Relatórios” (listagem real + botão visualizar)
Arquivo: `src/pages/external-domain/ExternalDomainReportsPage.tsx`

2.1. Implementar `fetchReports()` espelhando o `FirewallReportsPage.tsx`, mas usando a nova tabela:
- Ler `external_domain_analysis_history` com campos leves:
  - `id, domain_id, score, created_at` (order desc)
- Buscar dados de `external_domains` para os `domain_id` retornados:
  - `id, name, domain, client_id`
- Buscar `clients` para `client_id`:
  - `id, name`
- Montar `reports` no formato já esperado pela página e popular:
  - `setClients(...)`, `setDomains(...)`
  - `setReports(formattedReports)`

2.2. Botão “Visualizar” (carregar sob demanda + navegar para detalhe)
- Adicionar `fetchReportData(analysisId)`:
  - Query: `external_domain_analysis_history` select `report_data, created_at, domain_id` (ou pelo menos `report_data` + `created_at`)
- Ao clicar em visualizar:
  - Buscar o report_data
  - Navegar para a nova rota de detalhe, passando `state`:
    - `state: { report: reportData, analysisCreatedAt: created_at, domainMeta: { domain_id, domain_name, domain_url, client_name } }`
  - Isso evita uma segunda chamada no detalhe (mas o detalhe ainda deve funcionar com refresh, sem state)

2.3. Remover/ocultar PDF
- Remover o botão “Baixar PDF” do External Domain Reports (ou manter desabilitado com tooltip “Em breve”, mas como você pediu “não por enquanto”, o mais simples é remover para não confundir).
- Importante: não vamos reaproveitar o `exportReportToPDF` nesse módulo nesta etapa.

3) Frontend — Página de detalhe do relatório (Domínio Externo)
Novo arquivo:
- `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`

3.1. Rota
- Atualizar `src/App.tsx`:
  - Adicionar lazy import da nova página
  - Adicionar rota, por exemplo:
    - `/scope-external-domain/domains/:id/report/:analysisId`
  - (onde `:id` é o domain_id)

3.2. Fonte de dados (state ou fetch)
Na página de detalhe:
- Se existir `location.state.report`:
  - Normalizar e renderizar direto
- Se não existir (ex: usuário deu refresh/F5):
  - Buscar:
    - `external_domains` por `id` (para cabeçalho)
    - `external_domain_analysis_history` por `analysisId` (ou fallback: “último do domínio” se o analysisId não existir)
  - Montar `generatedAt` a partir do `created_at` do histórico

3.3. Normalização do report
- Reaproveitar a mesma estratégia de `normalizeReportData` do `FirewallAnalysis.tsx`:
  - Normalizar `categories` (array vs object)
  - Converter `warn` -> `warning`
  - Calcular `totalChecks/passed/failed/warnings`
- Implementação:
  - Opção A (preferível): extrair `normalizeReportData` e helpers para um util compartilhado (ex: `src/lib/normalizeComplianceReport.ts`) e usar tanto no firewall quanto no external-domain.
  - Opção B (mais rápida e segura para não quebrar firewall): duplicar a função na nova página (e depois refatorar quando estiver estável).
- Vou escolher a abordagem com menor risco imediato: duplicar na nova página primeiro, e (se ficar tudo ok) fazer uma pequena refatoração opcional depois.

3.4. UI do detalhe (sem PDF, com cabeçalho específico)
- Em vez de usar `Dashboard` (ele tem botões de PDF e campos de firewall), renderizar a página com:
  - ScoreGauge
  - StatCard (totais)
  - CategorySection (categorias)
- Cabeçalho: card mostrando
  - Nome do domínio
  - Domínio (ex: example.com)
  - Cliente
  - Data do relatório
- Botões:
  - “Voltar” para `/scope-external-domain/reports`
  - Sem “Exportar PDF”
  - Sem “Reanalisar” nesta página (reanálise já acontece na tela de Domínios; manter simples)

4) Ajustes finais (UX e compatibilidade)
- Garantir loading/empty states coerentes:
  - Sem histórico: CTA para “Verificar Domínio”
- Garantir que filtros cliente/domínio continuem funcionando como hoje.
- Garantir que o clique em “Visualizar” sempre funcione mesmo se o report_data estiver grande (por isso carregamento sob demanda).
- Checar que as RLS policies permitem:
  - Usuário logado ver `external_domain_analysis_history` via join com `external_domains` + `has_client_access`.

5) Validação (passo a passo para você testar)
- Fazer uma análise de domínio (fluxo já existente).
- Confirmar no Supabase (Test):
  - `external_domains.last_scan_at` atualizado
  - `external_domains.last_score` preenchido
  - Existe registro em `external_domain_analysis_history` para o domain_id
- UI:
  - Ir em “Domínio Externo > Relatórios” e ver a linha do domínio + quantidade de verificações
  - Selecionar uma data diferente no select e ver score mudar
  - Clicar “Visualizar” e abrir a página de detalhe com score e categorias
  - Dar refresh (F5) na página de detalhe e confirmar que ela recarrega do banco corretamente

Arquivos que serão afetados
- Backend:
  - Editar: `supabase/functions/agent-task-result/index.ts`
- Frontend:
  - Editar: `src/pages/external-domain/ExternalDomainReportsPage.tsx`
  - Criar: `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx`
  - Editar: `src/App.tsx`

Observações de segurança/operacionais
- O alerta “Leaked Password Protection Disabled” será ignorado conforme sua instrução; não muda o escopo deste módulo.
- A edge function opera como service_role, então a policy “Service role can manage external domain history” garantirá persistência do histórico.
