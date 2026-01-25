
# Plano: Remover tela "Administração > Tarefas"

## Contexto
A tela de Tarefas no menu de Administração não está sendo utilizada e deve ser removida para simplificar a interface. A funcionalidade de visualização de execuções já existe dentro do módulo Firewall em `/scope-firewall/executions`.

## Arquivos a Deletar

### Página principal
- `src/pages/admin/TasksPage.tsx` (536 linhas)

### Componentes exclusivos da página
- `src/components/admin/TaskStatsCards.tsx`
- `src/components/admin/TaskStatusChart.tsx`  
- `src/components/admin/TaskTimelineChart.tsx`
- `src/components/admin/TaskAgentPerformance.tsx`
- `src/components/admin/TaskDetailDialog.tsx`

**Total: 6 arquivos**

---

## Arquivos a Modificar

### 1. `src/App.tsx`

**Remover:**
- Linha 24: import do `TasksPage`
- Linha 99: rota `/tasks`

### 2. `src/components/layout/AppLayout.tsx`

**Remover:**
- Linha 174: referência a `/tasks` na condição do menu admin
- Linha 351: referência a `/tasks` na variável `isAdminRoute`
- Linhas 452-464: link "Tarefas" no menu de administração (12 linhas)

---

## Impacto

| Item | Status |
|------|--------|
| Funcionalidade perdida | Nenhuma - visualização de execuções disponível em Firewall > Execuções |
| Rotas afetadas | `/tasks` será removida |
| RLS/Database | Sem alterações - tabela `agent_tasks` permanece |
| Edge Functions | Sem alterações |

---

## Ordem de Execução

1. Modificar `src/App.tsx` (remover import e rota)
2. Modificar `src/components/layout/AppLayout.tsx` (remover referências ao menu)
3. Deletar os 6 arquivos de componentes

---

## Validação Pós-Implementação

- Menu "Administração" não mostra mais "Tarefas"
- Acesso direto a `/tasks` retorna página 404
- Build sem erros de import
