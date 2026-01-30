
Contexto (por que “nas telas não mudou nada”)
- O que foi aplicado até agora foi só a MIGRATION do banco (adicionar o valor `external_domain_analysis` no enum `agent_task_type`) + atualização do `types.ts`.
- Isso, sozinho, não altera:
  1) as tasks antigas (elas continuam com `task_type = ssh_command` já gravado no banco), nem
  2) as tasks novas (porque o edge function `trigger-external-domain-analysis` ainda está inserindo `task_type: 'ssh_command'`), nem
  3) a tela de Firewall > Execuções (porque `TaskExecutionsPage.tsx` ainda não filtra por `target_type = 'firewall'`), então ela continua puxando tudo.

Diagnóstico confirmado no código atual
1) Firewall > Execuções “vazando” external_domain
- `src/pages/firewall/TaskExecutionsPage.tsx` faz `from('agent_tasks')` e NÃO tem `.eq('target_type', 'firewall')`.
- Resultado: aparece task de domínio externo (com `ssh_command`) nessa tela.

2) Domínio duplicado na tela de Domínio Externo > Execuções
- `src/pages/external-domain/ExternalDomainExecutionsPage.tsx` tem:
  - `return d.name ? \`\${d.name} (\${d.domain})\` : d.domain;`
- Se `name === domain` (ex.: estrela.com.br), ele renderiza “estrela.com.br (estrela.com.br)”.

3) Tipo ainda “ssh_command”
- `supabase/functions/trigger-external-domain-analysis/index.ts` ainda insere:
  - `task_type: 'ssh_command'`
- Mesmo com o enum novo existindo, nada muda até trocar esse insert.

Objetivo (o que vamos entregar)
A) Firewall > Execuções: listar somente firewall
B) Domínio Externo > Execuções: parar de duplicar o domínio
C) Tipo técnico correto: tarefas novas de domínio externo passarem a ser `external_domain_analysis`
D) Compatibilidade: tarefas antigas `ssh_command` (target_type=external_domain) aparecerem como `external_domain_analysis` na UI (normalização visual), sem mexer em histórico

Plano de implementação (mudanças necessárias)
1) Corrigir filtro na tela Firewall > Execuções
Arquivo: `src/pages/firewall/TaskExecutionsPage.tsx`
- No query principal que busca tarefas:
  - adicionar `.eq('target_type', 'firewall')` antes do `.gte(...)`.
- Benefício: tasks de domínio externo somem dessa tela imediatamente após reload/refetch.

2) Corrigir duplicidade do nome do domínio (label)
Arquivo: `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`
- Atualizar `getDomainLabel(domainId)` para:
  - se não achou: retorna `domainId`
  - se `name` vazio: retorna `domain`
  - se `name.trim().toLowerCase() === domain.trim().toLowerCase()`: retorna `domain`
  - senão: retorna `${name} (${domain})`
- Impacto: tabela e modal de detalhes deixam de mostrar duplicado.

3) Fazer novas execuções de Domínio Externo criarem `external_domain_analysis`
Arquivo: `supabase/functions/trigger-external-domain-analysis/index.ts`
- Trocar no insert:
  - `task_type: 'ssh_command'`
  - para `task_type: 'external_domain_analysis'`
- Observação importante: isso só afeta execuções novas, não altera histórico antigo.

4) Normalizar visualmente tasks antigas (legado) na UI
Arquivo: `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`
- No local onde renderiza `task.task_type` (Badge da coluna “Tipo”), criar um “displayTaskType”:
  - Se `task.target_type === 'external_domain'` e `task.task_type === 'ssh_command'`, exibir `external_domain_analysis`
  - Caso contrário, exibir `task.task_type` normal
- Opcional (mas recomendado): aplicar a mesma normalização também no modal de detalhes, se ele mostrar o tipo em algum lugar.

5) Deploy e validação
- Deploy do edge function atualizado (`trigger-external-domain-analysis`) para o ambiente.
- Testes end-to-end:
  1) Abrir Firewall > Execuções e confirmar que não aparece mais `target_type=external_domain` (nenhum “ssh_command” vindo de domínio externo).
  2) Abrir Domínio Externo > Execuções e confirmar que “estrela.com.br (estrela.com.br)” vira “estrela.com.br”.
  3) Disparar uma nova análise de domínio externo e confirmar que o tipo agora é `external_domain_analysis`.
  4) Confirmar que tarefas antigas continuam existindo no banco como `ssh_command`, mas a UI mostra `external_domain_analysis` para consistência.

Riscos / observações
- Se você estiver olhando para o ambiente Published (produção) e a mudança foi aplicada só no Preview (teste), é possível “não ver diferença” sem publicar. (Se necessário, conferimos qual URL você está usando e se o app está publicado.)
- Mesmo no Preview, se a tela estiver cacheada, basta “Atualizar” (botão) ou dar reload; mas a correção real depende de fazermos os ajustes nos arquivos acima.

Arquivos que serão modificados
- `src/pages/firewall/TaskExecutionsPage.tsx`
- `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`
- `supabase/functions/trigger-external-domain-analysis/index.ts`
