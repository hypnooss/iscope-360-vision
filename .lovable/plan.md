
Objetivo
- Corrigir o cenário em que o M365 Analyzer “executa” para NEXTA/MOVECTA, mas entrega snapshot `completed` com `score=100`, `insights=0` e métricas zeradas.

Diagnóstico confirmado (com evidência)
1) O pipeline está executando até o fim
- `agent-task-result` chama `m365-analyzer` normalmente.
- Logs recentes mostram:
  - `Result: score=100, insights=0`
  - `Data ready (source=agent): emails=0, mailboxes=0, signIns=0, audits=0`
2) Os steps coletados pelo agent existem e têm dados
- Para as tasks de NEXTA/MOVECTA há 18 steps `exo_*` (ex.: `exo_mailbox_forwarding`, `exo_anti_phish_policy`, `exo_org_config` etc).
- Ex.: MOVECTA trouxe vários registros em `exo_mailbox_forwarding`.
3) Causa raiz real (dupla)
- Causa A: `m365-analyzer` está mapeando chaves erradas para dados do agent (`signin_logs`, `audit_logs` etc), mas o agent entrega `exo_*`.
- Causa B: o contrato de `metrics` da Edge Function não bate com o contrato esperado no frontend (`src/types/m365AnalyzerInsights.ts`), então mesmo quando houver dado, parte da tela continua zerada.
4) Efeito prático
- Snapshots ficam “completos” porém vazios, gerando falsa sensação de sucesso.

Plano de implementação

Fase 1 — Normalização de entrada (Edge Function)
Arquivo:
- `supabase/functions/m365-analyzer/index.ts`

Ações:
1. Criar normalizador robusto para step result:
- Aceitar formatos: array, objeto único, string JSON, `{data: ...}`, `{value: ...}`, `{results: ...}`.
- Quando vier objeto único (caso comum de NEXTA), transformar em array de 1 item.
- Quando vier string JSON, fazer parse seguro (`try/catch`) e normalizar.
2. Mapear explicitamente os steps reais `exo_*`:
- `exo_mailbox_forwarding`
- `exo_transport_rules`
- `exo_org_config`
- `exo_safe_links_policy`
- `exo_safe_attachment_policy`
- `exo_anti_phish_policy`
- `exo_hosted_content_filter`
- `exo_malware_filter_policy`
- `exo_remote_domains`
- (e demais que agreguem sinal de risco)
3. Remover dependência “vazia” de `signin_logs/audit_logs` quando a origem for agent EXO, para não cair em análise sem sinais.

Fase 2 — Gerar insights úteis a partir dos dados EXO já coletados
Arquivo:
- `supabase/functions/m365-analyzer/index.ts`

Ações:
1. Regras de insight imediatas (baixa ambiguidade):
- Encaminhamento externo (`exo_mailbox_forwarding`) -> insights `suspicious_rules` (high/critical por volume/externo).
- Transport rules com redirect/copy/delete -> insights `suspicious_rules`.
- SMTP auth habilitado (`exo_org_config`) -> insight `operational_risks`.
- Safe Links/Safe Attachments desabilitados -> insight em `phishing_threats`/`operational_risks`.
- Anti-phish policy fraca -> insight `phishing_threats`.
2. Preencher `summary` e `score` com base nesses insights (sem quebrar lógica atual).

Fase 3 — Alinhar contrato de métricas backend x frontend
Arquivos:
- `supabase/functions/m365-analyzer/index.ts`
- `src/hooks/useM365AnalyzerData.ts` (normalização defensiva)

Ações:
1. Fazer a Edge salvar `metrics` no formato esperado pelo frontend:
- `phishing.totalBlocked`, `phishing.quarantined`, `phishing.topAttackedUsers`, `phishing.topSenderDomains`
- `mailbox.totalMailboxes`, `mailbox.above80Pct`, `mailbox.above90Pct`, `mailbox.topMailboxes`
- `behavioral.anomalousUsers`, `behavioral.deviations`
- `compromise.suspiciousLogins`, `compromise.correlatedAlerts`, `compromise.topRiskUsers`
- `rules.externalForwards`, `rules.autoDelete`, `rules.suspiciousRules`
- `exfiltration.highVolumeExternal`, `exfiltration.topExternalDomains`
- `operational.smtpAuthEnabled`, `operational.legacyProtocols`, `operational.inactiveWithActivity`, `operational.fullAccessGrants`
2. No hook `parseSnapshot`, manter fallback forte por subcampo (não apenas por seção), para tolerar snapshots antigos com schema legado.

Fase 4 — Compatibilidade retroativa e observabilidade
Arquivos:
- `supabase/functions/m365-analyzer/index.ts`
- `src/pages/m365/M365AnalyzerDashboardPage.tsx` (apenas ajustes de texto/estado, se necessário)

Ações:
1. Incluir `metrics.dataSource` e `metrics.normalizationVersion` para troubleshooting.
2. Exibir aviso leve quando snapshot veio de schema antigo (opcional), evitando confusão de “zerado”.

Fase 5 — Validação funcional
Validações obrigatórias:
1. Executar análise em NEXTA e MOVECTA após deploy.
2. Confirmar no banco:
- `m365_analyzer_snapshots.status = completed`
- `jsonb_array_length(insights) > 0` (ao menos em tenant com forwarding/rules)
- métricas preenchidas nas chaves esperadas.
3. Confirmar na UI:
- cards não zerados quando houver achados
- abas por categoria com insights renderizados
- sem erros runtime.
4. Confirmar regressão:
- fluxo de fallback Graph (quando existir credencial) continua funcional.

Sequenciamento recomendado
1) Corrigir normalização/mapeamento de entrada (Fase 1).
2) Ajustar geração de insights EXO (Fase 2).
3) Alinhar schema de métricas e fallback do hook (Fase 3).
4) Deploy da função `m365-analyzer`.
5) Rodar duas coletas reais (NEXTA/MOVECTA) e validar ponta a ponta (Fase 5).

Riscos e mitigação
- Risco: heterogeneidade de formato em `task_step_results.data`.
  - Mitigação: normalizador único + parse seguro + logs por step.
- Risco: snapshots antigos continuarem com “cara de vazio”.
  - Mitigação: fallback no hook e foco em novas execuções pós-deploy.
- Risco: duplicidade conceitual com M365 Posture.
  - Mitigação: manter Analyzer orientado a detecção operacional/risco imediato, sem remover Posture.

Resultado esperado
- Após nova execução em NEXTA/MOVECTA, o Analyzer deixa de “completar vazio” e passa a mostrar insights e métricas reais baseados nos steps EXO já coletados pelo agent.
