

## Plan: Consolidar M365 Tenant Edit em card único

### Mudanças em `src/pages/environment/M365TenantEditPage.tsx`

1. **Unificar tudo em um único Card** — Mesclar os 3 cards (Info Grid, Permissões, Ações) em um só.

2. **Remover métricas de análise** — Remover os campos "Última Análise", "Score" e "Agendamento" do grid. Manter apenas "Workspace".

3. **Mover status de conexão para dentro do card** — Tirar o badge do header externo e colocá-lo dentro do card, ao lado do workspace info.

4. **Permissões sempre visíveis** — Remover o toggle expand/collapse (`showPermissions` state, `ChevronDown`/`ChevronUp`). Exibir a seção de permissões e RBAC diretamente, sempre aberta.

5. **Remover botão "Analisar"** — Remover o handler `handleAnalyze`, state `analyzing`, e o botão.

6. **Alinhar botões à direita** — Os botões restantes (Testar, Editar, Revalidar Permissões, Desconectar, Excluir) ficam alinhados à direita com `justify-end`.

7. **Cleanup** — Remover imports não utilizados (`Play`, `TrendingUp`, `Calendar`, `ChevronDown`, `ChevronUp`) e queries desnecessárias (`lastAnalysis`, `schedule`).

