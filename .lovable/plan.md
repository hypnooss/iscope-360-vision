
## Objetivo
Impedir que tarefas do módulo **Domínio Externo** (ex.: `task_type = external_domain_analysis`) apareçam na tela **Firewall → Execuções**, e garantir que elas apareçam apenas em **Domínio Externo → Execuções**.

## Diagnóstico (por que está acontecendo)
- A tela **Firewall → Execuções** (`src/pages/firewall/TaskExecutionsPage.tsx`) já filtra por `target_type = 'firewall'`.
- Mesmo assim, na sua captura aparecem tarefas com `task_type = external_domain_analysis` e “Firewall = Desconhecido”. Isso indica que:
  - essas tarefas foram gravadas na tabela `agent_tasks` com `target_type = 'firewall'` (provavelmente por versões antigas do trigger que não preenchiam `target_type`, então o default do banco era `'firewall'`).
  - o `target_id` delas é um `domain_id`, não um `firewall_id`, por isso a coluna “Firewall” mostra “Desconhecido”.
- O trigger atual (`supabase/functions/trigger-external-domain-analysis/index.ts`) já insere corretamente `target_type = 'external_domain'`, então o problema mais provável é **legado (dados antigos)** + **filtro insuficiente no frontend** (ele confia que `target_type` sempre está correto).

## Estratégia de correção (2 camadas)
### Camada A — Correção imediata no frontend (não depende de mexer no banco)
Ajustar a query de Firewall Execuções para garantir que apenas tarefas cujo `target_id` existe na tabela `firewalls` sejam exibidas.

Por que isso é melhor do que filtrar só por `task_type`?
- Evita ocultar tarefas legítimas que por acaso usem tipos genéricos.
- Resolve também qualquer outro “vazamento” futuro (qualquer tarefa que cair ali com `target_id` que não seja firewall, será excluída).
- Não depende de nomenclatura de `task_type`.

Implementação proposta:
1) Em `src/pages/firewall/TaskExecutionsPage.tsx`, no `queryFn` principal:
   - Buscar primeiro os `firewalls` acessíveis e obter `firewallIds`.
   - Buscar `agent_tasks` com:
     - `target_type = 'firewall'`
     - `target_id IN (firewallIds)`
     - `created_at >= startTime`
     - filtros de `status` como já existe
   - Se `firewallIds` estiver vazio, retornar `[]`.
2) Manter o `lookup` de `firewalls` (id, name) como está ou reaproveitar o resultado (opcional). O mais simples é buscar IDs no mesmo `queryFn` para garantir consistência.

Resultado esperado:
- As tarefas de domínio externo deixam de aparecer no Firewall Execuções imediatamente, mesmo que o banco tenha registros legados com `target_type` errado.

### Camada B — Correção definitiva via “limpeza” dos dados legados (recomendado)
Adicionar uma migração/SQL para corrigir tarefas antigas que foram gravadas com `target_type` incorreto.

SQL sugerido (rodar em Test e, se existir dado em Live, também em Live antes de publicar):
```sql
update public.agent_tasks
set target_type = 'external_domain'
where target_type = 'firewall'
  and task_type = 'external_domain_analysis';
```

Opcional (se existirem tasks legadas de domínio externo como `ssh_command` gravadas com target_type errado e você quiser corrigir também):
- Só faremos isso se você confirmar que `ssh_command` não é usado para firewall no seu ambiente, porque pode ter conflito.

Resultado esperado:
- Mesmo sem o filtro reforçado no frontend, os dados passam a estar semanticamente corretos.

## Verificações adicionais (para garantir que não há outro ponto criando tasks erradas)
1) Revisar os pontos que disparam análises de domínio externo:
   - `src/pages/external-domain/ExternalDomainListPage.tsx` (invoke do `trigger-external-domain-analysis`)
   - `src/pages/external-domain/ExternalDomainAnalysisReportPage.tsx` (refresh)
2) Confirmar que a edge function implantada é a versão atual do arquivo:
   - (Opcional) olhar logs de `trigger-external-domain-analysis` e validar que `target_type` está sendo persistido como `external_domain`.

## Plano de testes (end-to-end)
1) Abrir **Firewall → Execuções** e confirmar que:
   - tarefas com tipo `external_domain_analysis` não aparecem mais.
   - as tarefas de firewall continuam aparecendo normalmente.
2) Abrir **Domínio Externo → Execuções** e confirmar que:
   - tarefas `external_domain_analysis` aparecem ali (com o domínio correto).
3) Criar/rodar uma análise de domínio externo nova e confirmar:
   - ela cai em Domínio Externo Execuções
   - não aparece em Firewall Execuções
4) (Se aplicarmos o SQL) Revalidar:
   - tarefas antigas “sumiram” do Firewall Execuções porque agora pertencem ao Domínio Externo.

## Arquivos que serão alterados
- `src/pages/firewall/TaskExecutionsPage.tsx` (ajuste de query para filtrar por `target_id in firewalls`)
- (Opcional, recomendado) um script/migração ou instrução SQL para corrigir dados legados em `public.agent_tasks`

## Riscos / cuidados
- A abordagem “target_id IN firewalls” adiciona uma consulta extra (para buscar IDs de firewalls). Como o limite de tasks é 100 e o número de firewalls por cliente costuma ser baixo/médio, o impacto tende a ser pequeno.
- Se houver milhares de firewalls, podemos otimizar (buscar só IDs, limitar por tempo, cache via React Query, ou reutilizar `firewalls-lookup`).
