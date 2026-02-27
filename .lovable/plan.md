
Objetivo: eliminar os timeouts recorrentes nas coletas EXO do M365 Analyzer sem depender de “inteligência hardcoded” por regra/step, mantendo o comportamento orientado por template/blueprint.

Resumo do diagnóstico confirmado:
- O erro não é timeout de Edge Function neste fluxo; é timeout no Agent PowerShell.
- Evidência de banco: em `task_step_results` (task `ebfc3f35-a5a5-41ff-98cb-f90a5531facb`), todos os steps EXO falham com:
  - `error_message = "Execution timed out after 120 seconds"`
  - `duration_ms = 5219` igual para todos os steps
- Esse padrão indica timeout único no batch PowerShell inteiro, propagado para todos os steps.
- Blueprint ativo `M365 - Exchange Online` está com primeiro step `exo_mailbox_forwarding` em `timeout: 120`.
- Como o erro final continua em 120s, os agentes em produção estão se comportando como versão/artefato legado (usando timeout base do primeiro step do batch), mesmo reportando `agent_version=1.3.4`.

Plano de implementação (sequência recomendada):

1) Hotfix imediato no banco (sem esperar atualização de agente)
- Aplicar migration SQL para ajustar o blueprint ativo `M365 - Exchange Online`:
  - Definir timeout de segurança alto no primeiro step EXO do batch (`exo_mailbox_forwarding`) para `960`.
  - Manter os demais timeouts como estão (30/60/120/180/300), pois no agente novo eles já são agregados dinamicamente.
- Motivo: em agentes legados, o timeout efetivo do batch tende a herdar o primeiro step; elevar esse valor remove o gargalo imediato.
- Também corrigir duplicidade de `exo_auth_policy` no array de steps (há duas entradas com mesmo `id`), para evitar colisão de resultado/telemetria.

2) Correção estrutural para não regredir
- Versionar o agente para `1.3.5` (ou próximo patch), garantindo rollout da lógica de timeout dinâmico por batch.
- Atualizar `system_settings.agent_latest_version` para forçar distribuição.
- Validar que o pacote publicado no bucket `agent-releases` corresponde ao código com:
  - cálculo de batch timeout escalonado (`300 + (N-1)*30`)
  - fallback de segurança quando existirem timeouts por step.
- Sem isso, futuros agentes/hosts podem continuar presos ao comportamento legado mesmo com blueprint corrigido.

3) Melhoria de observabilidade (diagnóstico rápido em produção)
- No `python-agent/agent/tasks.py` (método `_execute_powershell_batch`), enriquecer log de erro com:
  - `computed_batch_timeout`
  - quantidade de comandos do batch
  - módulo (ExchangeOnline/MicrosoftGraph)
- Isso reduz tempo de diagnóstico em incidentes futuros e evita “falso positivo” de timeout da Edge Function.

4) Validação funcional pós-correção
- Disparar nova execução em `/scope-m365/executions`.
- Critérios de aceite:
  - não aparecer mais “Execution timed out after 120 seconds” em massa para todos os steps EXO;
  - steps deixam de falhar em bloco por timeout único;
  - `agent_tasks.error_message` passa a refletir erros reais pontuais (permissão/cmdlet/licença), quando existirem;
  - snapshots voltam a `completed` ou `partial` com dados úteis.
- Query de verificação sugerida:
  - últimos `agent_tasks` de `task_type='m365_analyzer'` com status e prefixo de erro;
  - `task_step_results` do task mais recente para conferir variação real de `duration_ms` e ausência de timeout massivo em 120s.

Detalhes técnicos (implementação):
- Arquivos a alterar:
  - `supabase/migrations/*` (novo patch SQL para `device_blueprints.collection_steps`)
  - `python-agent/agent/version.py` (bump de versão)
  - `python-agent/agent/tasks.py` (log/telemetria adicional)
- Estratégia SQL:
  - atualização idempotente no JSONB de `collection_steps.steps`, mirando blueprint ativo por nome+executor_type+is_active.
  - preservar estrutura atual e alterar apenas os nós necessários (`exo_mailbox_forwarding.timeout`, remoção da duplicata `exo_auth_policy`).

Riscos e mitigação:
- Risco: timeout de 960 pode alongar execução em casos realmente travados.
  - Mitigação: permanece controlado por expiração da task no backend e melhora de logs para investigação.
- Risco: existir mais de um blueprint Exchange ativo no futuro.
  - Mitigação: migration com filtro explícito + validação pós-update.

Resultado esperado:
- Correção imediata para os agentes que ainda operam com timeout legado.
- Arquitetura permanece data-driven via blueprint/template (sem hardcode por regra).
- Caminho definitivo com rollout de versão para eliminar dependência do “timeout de segurança” no primeiro step.
