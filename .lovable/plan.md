
Objetivo (o que vai mudar)
1) Garantir que o botão “Analisar” (na lista de Domínios Externos) dispare uma tarefa que apareça imediatamente em “Domínio Externo > Execuções”, igual ao fluxo de Firewall.
2) Evoluir a “análise de domínio externo” para uma varredura DNS completa (multi-steps), executada pelo python-agent, com:
   - NS
   - MX
   - SOA (+ SOA Contact)
   - SPF (TXT) com parsing detalhado
   - DMARC (TXT) com parsing detalhado
   - DKIM (TXT) usando a lista de selectors fornecida (cobre ~96%)
   - DNSSEC best-effort (cadeia/validação best-effort + coleta DNSKEY/DS)

Contexto atual (confirmado no código)
- O botão “Analisar” já chama `supabase.functions.invoke('trigger-external-domain-analysis', { body: { domain_id } })` em `ExternalDomainListPage.tsx`.
- A edge function `trigger-external-domain-analysis` já cria um registro em `agent_tasks` com:
  - `target_type = 'external_domain'`
  - `target_id = domain_id`
  - `agent_id` do domínio
  - `status = 'pending'`
  - prevenção de duplicidade pending/running (não-expirada)
- Porém:
  - A página `ExternalDomainExecutionsPage.tsx` está com placeholder (stats zeradas + tasks = []) e não lista tarefas reais.
  - A RPC `rpc_get_agent_tasks` (que o agent usa via edge function `agent-tasks`) para `external_domain` ainda retorna um blueprint simples `probe_https` (http_request). Não existe executor DNS no python-agent hoje.
  - A edge function `agent-task-result` calcula compliance/score apenas para `target_type='firewall'`. Para domínio externo ainda não há processamento “final” específico — mas isso não impede o básico (task completar/falhar e aparecer em Execuções).

Decisão de escopo (para entregar “o que de fato interessa” com segurança)
Vamos entregar em 2 blocos bem fechados e testáveis:
A) UX/Observabilidade: Execuções de Domínio Externo iguais às de Firewall (tarefas reais + detalhes + auto-refresh).
B) Execução real: Blueprint multi-step DNS + executor `dns_query` no python-agent (com a lista DKIM fornecida) + ajustes mínimos para completar a tarefa corretamente no backend.

A) Implementar Execuções reais para Domínio Externo (frontend)
Arquivos:
- src/pages/external-domain/ExternalDomainExecutionsPage.tsx

Mudanças planejadas
1) Trocar o placeholder por React Query, copiando o padrão de `src/pages/firewall/TaskExecutionsPage.tsx`, com ajustes:
   - Query principal em `agent_tasks`:
     - filtros de período (1h/6h/12h/24h) via `.gte('created_at', startTimeISO)`
     - filtro de status quando `statusFilter !== 'all'`
     - filtro fixo `eq('target_type', 'external_domain')`
     - selecionar apenas colunas “leves” (sem `payload`, `result`, `step_results`) para performance.
   - Auto-refresh:
     - `refetchInterval` = 10s quando existir task `pending` ou `running`.
2) Lookups para exibição humana:
   - Buscar `agents(id, name)` e mapear `agent_id -> name`.
   - Buscar `external_domains(id, domain, name)` e mapear `target_id -> domain/name`.
3) Search na lista:
   - pesquisar por `domain.name`, `domain.domain`, `agent.name` e `task.task_type`.
4) Modal de detalhes:
   - Ao abrir detalhes, buscar sob demanda em `agent_tasks`:
     - `payload`, `result`, `error_message`, `execution_time_ms`
   - E também (importante para multi-steps) buscar `task_step_results` por `task_id` para mostrar:
     - step_id, status, duration_ms, erro e data (com opção de expandir).
   - Isso deixa a tela pronta para o modo “vários steps” sem depender de “result final gigante”.

Pequena melhoria no UX do botão “Analisar”
Arquivos:
- src/pages/external-domain/ExternalDomainListPage.tsx

Mudança planejada (opcional mas recomendada):
- Após agendar com sucesso, além do toast, oferecer ação clara:
  - navegar automaticamente para `/scope-external-domain/executions`
  - ou manter na tela e adicionar “Ver Execuções” (ex.: `toast.success(..., { action: { label: 'Ver execuções', onClick: () => navigate(...) } })`), se o padrão do projeto já usar isso.

B) Blueprint multi-step DNS + executor no python-agent (backend + agente)
B1) Atualizar a RPC `rpc_get_agent_tasks` para external_domain (Supabase migration)
Arquivo:
- supabase/migrations/NEW__external_domain_dns_blueprint.sql (novo migration)

Mudança:
- Substituir o bloco “External domain tasks (probe HTTP/HTTPS)” por blueprint DNS multi-step (vários steps), retornando `executor: 'dns_query'` e `config` apropriado, com `domain` vindo de `external_domains.domain`.

Steps propostos (primeira versão)
1) ns_records:
   - query_type: "NS"
2) mx_records:
   - query_type: "MX"
3) soa_record:
   - query_type: "SOA"
   - (SOA Contact vem do campo rname do SOA; vamos parsear para contato humano no executor)
4) spf_record:
   - query_type: "SPF" (internamente TXT + filtro `v=spf1`)
5) dmarc_record:
   - query_type: "DMARC" (TXT em `_dmarc.${domain}`)
6) dkim_records:
   - query_type: "DKIM"
   - selectors: lista fornecida (abaixo)
7) dnssec_status:
   - query_type: "DNSSEC"
   - best_effort: true

Lista DKIM selectors (aprovada pelo usuário)
amazonses,ses,ses1,ses2,mailchimp,mc,k1,k2,k3,mailgun,mg,hubspot,hs,hs1,s1,s2,sendgrid,hs2,salesforce,sfmc,pardot,ex,cttarget,opendkim,postfix,mx1,mx2,cpanel,plesk,sendinblue,mailjet,mailcow,zimbra,icewarp,tiflux,selector1,selector2,default

Observação importante
- A `task_type` armazenada no `agent_tasks` hoje é “ssh_command” (apenas rótulo). Isso já está alinhado com o comentário no edge function; o que manda são os `steps` retornados pela RPC. Não precisamos mexer nisso agora.

B2) Implementar executor `dns_query` no python-agent
Arquivos:
- python-agent/agent/executors/dns_query.py (novo)
- python-agent/agent/tasks.py (editar para registrar executor)
- python-agent/requirements.txt (editar para incluir dependência)

Dependência
- Adicionar `dnspython>=2.7.0` no requirements.

Contrato do executor (compatível com TaskExecutor)
- Input: `step.config` com { query_type, domain, selectors?, best_effort? }
- Output:
  - `{ status_code: 0, data: {...}, error: null }` em sucesso
  - `{ status_code: 0, data: {...}, error: '...' }` em erro recuperável (mantém tarefa rodando para outros steps)
- O TaskExecutor já envia progressivamente via `/agent-step-result`.

Formato de dados recomendado por step (para ficar fácil renderizar e consolidar)
- NS:
  - records: [{ host, ttl? }]
- MX:
  - records: [{ priority, exchange }]
- SOA:
  - mname, rname, serial, refresh, retry, expire, minimum
  - contact_email (derivado de rname)
- SPF:
  - raw: string
  - parsed: { mechanisms: [...], qualifiers: [...], includes: [...], ip4: [...], ip6: [...], a: [...], mx: [...], redirect?: string, all?: string }
- DMARC:
  - raw: string
  - parsed: { v, p, sp, rua, ruf, pct, adkim, aspf, fo, rf, ri, ... } (somente os encontrados)
- DKIM:
  - found: [{ selector, txt_raw, key_type?, key_size_bits?, p_length, flags? }]
  - missing_count / checked_count (para diagnósticos)
- DNSSEC (best-effort):
  - has_dnskey: boolean
  - has_ds: boolean
  - validated: boolean | "partial" | "unknown"
  - notes: string[]
  - records_sample: { dnskey_count, ds_count } (sem armazenar “gigante”)

B3) Ajustar o comportamento do `agent-task-result` para domínio externo (opcional nesta fase, mas recomendado)
Arquivo:
- supabase/functions/agent-task-result/index.ts

Situação atual
- Hoje ele reconstrói `rawData` a partir de `task_step_results` (modo progressivo), mas só processa “compliance rules” quando `target_type === 'firewall'`.
- Para domínio externo, ele ainda consegue finalizar a task (atualizar status/result), mas não grava “relatório histórico” nem atualiza `external_domains.last_score/last_scan_at` de forma “inteligente”.

O que vamos fazer agora (mínimo útil, sem inventar score final ainda)
- Incluir um ramo `else if (task.target_type === 'external_domain')` para:
  1) Reconstruir `rawData` do mesmo jeito (já existe)
  2) Salvar `result` no `agent_tasks` como `rawData` (ou um resumo) para facilitar visualização no modal de Execuções
  3) Atualizar `external_domains.last_scan_at = now()`
- Score:
  - Podemos colocar `last_score` como null inicialmente, até definirmos claramente pesos/regras (evitar “score fake”).
  - Alternativa: score inicial bem simples baseado em presença e qualidade (SPF/DMARC/DNSSEC/DKIM) — mas só se você confirmar a regra numa próxima etapa. Nesta entrega, foco em executar, registrar e visualizar.

(Em uma fase seguinte, aí sim criamos uma tabela `external_domain_analyses` + score/relatório e alimentamos a tela “Relatórios”.)

C) Validação end-to-end (o que você vai conseguir testar)
1) Em `/scope-external-domain/domains`:
   - Clicar “Analisar” em um domínio com agent configurado
   - Ver toast de sucesso
2) Ir para `/scope-external-domain/executions`:
   - Ver a task criada (status pending/running)
   - Abrir detalhes e ver:
     - payload (domain, client_id)
     - step_results (quando o agent começar a enviar)
3) Rodar o python-agent (do cliente) atualizado:
   - Ele vai puxar a tarefa via `/agent-tasks`
   - Executar steps DNS e enviar `agent-step-result` progressivo
   - Finalizar com `agent-task-result`
4) Voltar em Execuções:
   - Conferir steps com status success/fail e dados por step
   - Conferir task final `completed`/`failed` conforme comportamento real

Riscos e cuidados (já considerados no plano)
- DNSSEC best-effort: validação completa pode ser complexa dependendo do resolvedor e cadeia; por isso o executor retornará “validated: true/false/partial/unknown” com notes, sem bloquear a execução.
- DKIM selectors: a lista é grande (boa cobertura), mas pode aumentar o tempo de execução. Mitigação:
  - timeouts curtos por query
  - resolver com caching interno (dnspython já ajuda)
  - limitar o tamanho armazenado do TXT (evitar JSON gigante)
- Execuções UI: cuidado para não carregar `result` pesado de todas as tasks; por isso o padrão “carregar detalhes sob demanda”.

Arquivos que serão alterados/criados (na implementação após aprovação)
Frontend
- Editar: src/pages/external-domain/ExternalDomainExecutionsPage.tsx
- Editar (opcional UX): src/pages/external-domain/ExternalDomainListPage.tsx

Supabase
- Criar migration: supabase/migrations/NEW__external_domain_dns_blueprint.sql (update rpc_get_agent_tasks)
- Editar (recomendado): supabase/functions/agent-task-result/index.ts

Python Agent
- Criar: python-agent/agent/executors/dns_query.py
- Editar: python-agent/agent/tasks.py
- Editar: python-agent/requirements.txt

Critérios de aceite (objetivos de produto)
- “Analisar” cria tarefa e ela aparece em Execuções imediatamente.
- Execuções mostra progresso por step (quando agent envia).
- A análise coleta e retorna (por step) os dados DNS pedidos: NS, MX, SOA(+contact), SPF parse, DMARC parse, DKIM (selectors lista), DNSSEC best-effort.
