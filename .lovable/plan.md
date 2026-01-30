
Contexto (o que está acontecendo e por quê)
1) Execuções de “Domínios externos” aparecendo em “Firewall > Execuções”
- A página `src/pages/firewall/TaskExecutionsPage.tsx` lista tarefas de `agent_tasks` apenas filtrando por data/status, mas não filtra por `target_type`.
- Como `agent_tasks` hoje contém tarefas de `target_type = 'firewall'` e `target_type = 'external_domain'`, a tela de firewall acaba mostrando tudo.

2) “Domínio” aparece duplicado na tela de execuções de domínios externos
- Em `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`, a função:
  - `getDomainLabel()` retorna `name (domain)` quando `name` existe.
- Se `name` for igual ao próprio `domain` (ex.: name="estrela.com.br" e domain="estrela.com.br"), isso vira `estrela.com.br (estrela.com.br)`.

3) Coluna “Tipo” mostrando `ssh_command` e a dúvida “isso não é ssh_command”
- No banco, `agent_tasks.task_type` é um enum (`agent_task_type`) e hoje inclui valores como `fortigate_compliance`, `ssh_command`, etc.
- Para “Domínios externos”, o edge function `supabase/functions/trigger-external-domain-analysis/index.ts` cria a task com `task_type: 'ssh_command'`.
- Porém, na prática, a execução real do “que o agent faz” vem do blueprint (RPC `rpc_get_agent_tasks` sempre traz steps do blueprint do device_type `external_domain`). Ou seja, `task_type` virou um rótulo legado e confuso nesse contexto.
- Faz sentido você estranhar: do ponto de vista do produto, é “Análise de Domínio Externo”, não “ssh_command”.

Objetivo do ajuste
A) Separar corretamente as telas:
- “Firewall > Execuções” deve listar apenas tasks de firewall.
- “Domínio Externo > Execuções” deve listar apenas tasks de domínio externo (já faz).

B) Corrigir a duplicidade do nome do domínio:
- Exibir apenas `domain` quando `name` estiver vazio OU for igual ao domain.
- Exibir `name (domain)` apenas quando forem diferentes.

C) Tornar o “Tipo” tecnicamente correto e menos confuso:
- Manter coluna técnica, mas com um valor técnico que represente “external domain analysis”, e não “ssh_command”.

Solução proposta (mudanças)
1) Firewall > Execuções: filtrar por target_type
Arquivo: `src/pages/firewall/TaskExecutionsPage.tsx`
- No `useQuery` de tarefas (query em `agent_tasks`), adicionar:
  - `.eq('target_type', 'firewall')`
- Isso garante que “Firewall > Execuções” não puxe tarefas de domínios externos.
- Também avaliaremos o texto do placeholder de busca (“Buscar por firewall, agent ou tipo…”) e o lookup de firewalls: com esse filtro, ficará consistente.

2) Domínio Externo > Execuções: ajustar o label do domínio para não duplicar
Arquivo: `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`
- Alterar `getDomainLabel(domainId)` para:
  - Se não achou o domínio: retorna `domainId` (como hoje)
  - Se `name` está vazio/null: retorna `domain`
  - Se `name.trim().toLowerCase() === domain.trim().toLowerCase()`: retorna `domain`
  - Senão: retorna `${name} (${domain})`
- Isso corrigirá tanto a tabela quanto o modal de detalhes (ambos usam `getDomainLabel`).

3) Tipo “ssh_command” para Domínios Externos: introduzir task_type específico
Para não “mascarar” via UI apenas, vamos corrigir a origem.

3.1) Banco: adicionar novo valor no enum `agent_task_type`
Arquivo: novo migration SQL em `supabase/migrations/` (criado em modo implementação)
- Executar:
  - `ALTER TYPE agent_task_type ADD VALUE IF NOT EXISTS 'external_domain_analysis';`
- Observação: não remove/renomeia `ssh_command` (para não quebrar histórico e nem outros usos).

3.2) Criador de task de domínio externo: usar o novo task_type
Arquivo: `supabase/functions/trigger-external-domain-analysis/index.ts`
- Trocar:
  - `task_type: 'ssh_command'`
- Por:
  - `task_type: 'external_domain_analysis'`

3.3) UI (opcional, mas recomendado): exibir legados com consistência
Arquivo: `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`
- Como existem tarefas antigas já gravadas com `ssh_command`, faremos uma normalização de exibição:
  - Se `task.target_type === 'external_domain'` e `task.task_type === 'ssh_command'`, exibir como `external_domain_analysis` (ex.: no Badge).
  - Se `task.task_type === 'external_domain_analysis'`, exibir normalmente.
- Isso mantém a coluna técnica “correta” sem precisar alterar dados históricos.

Explicação curta que ficará documentada no produto (para você e para usuários internos)
- “Tipo” = rótulo técnico da tarefa (enum no banco).
- Para domínios externos, a execução usa steps do blueprint `external_domain` (pode envolver comandos via SSH no agent), mas o nome correto para o produto é `external_domain_analysis`.
- `ssh_command` fica como legado/execução genérica, não como “tipo de análise”.

Checklist de testes (end-to-end)
1) Firewall > Execuções
- Confirmar que só aparecem tasks com `target_type = firewall`.
- Confirmar que tasks de domínio externo não “vazam” mais para lá.

2) Domínio Externo > Execuções
- Confirmar que “estrela.com.br (estrela.com.br)” vira “estrela.com.br”.
- Confirmar que quando name != domain (ex.: “Estrela (estrela.com.br)”) mantém o formato com parênteses.

3) Tipo
- Criar uma nova execução de domínio externo e confirmar que “Tipo” mostra `external_domain_analysis`.
- Confirmar que execuções antigas (se existirem) com `ssh_command` aparecem como `external_domain_analysis` (normalização visual).

Arquivos que serão modificados
- `src/pages/firewall/TaskExecutionsPage.tsx`
- `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`
- `supabase/functions/trigger-external-domain-analysis/index.ts`
- `supabase/migrations/<novo_migration>_add_external_domain_analysis_to_agent_task_type.sql` (novo)

Riscos e considerações
- Alterar enum exige migration; se o projeto já tiver ambiente Live publicado, vamos checar se há dependências antes de publicar (mas é uma adição de valor, baixo risco).
- O histórico permanecerá com `ssh_command` em linhas antigas; por isso a normalização visual é importante para consistência.
