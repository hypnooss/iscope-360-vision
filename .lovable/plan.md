

## Plano: Barra de status de análise nas telas de Compliance

### Problema
Ao clicar em "Executar Análise" nas telas de Compliance (Firewall e Domain), o botão muda brevemente para "Analisando..." mas volta ao normal assim que a edge function responde. Não há indicação visual de que o agent está processando a tarefa.

### Solução
Adicionar polling do status da tarefa (`agent_tasks`) e exibir uma barra de progresso similar à do Surface Analyzer, com auto-refetch dos dados quando a tarefa for concluída.

### Mudanças

#### 1. `src/pages/firewall/FirewallCompliancePage.tsx`

- Adicionar estado `activeTaskId` que é preenchido quando `handleRefresh` retorna o `task_id`
- Adicionar `useQuery` com `refetchInterval: 5000` para pollar `agent_tasks.status` enquanto o task está pendente/processing
- Quando o status mudar para `completed`/`failed`/`timeout`, limpar `activeTaskId` e invalidar os queries de snapshots para carregar os novos dados
- Renderizar card de progresso (estilo glass-card com Loader2 + texto + botão Atualizar) entre o header e o conteúdo, quando `isRunning === true`
- Remover o `setIsRefreshing(false)` imediato — só desligar quando o polling detectar conclusão

#### 2. `src/pages/external-domain/ExternalDomainCompliancePage.tsx`

- Mesmas mudanças: estado `activeTaskId`, polling via `useQuery`, card de progresso, auto-refetch ao concluir

#### Componente de progresso (inline em ambas as páginas)
```text
┌──────────────────────────────────────────────────────┐
│ ⟳ Análise em andamento...           ⟳ Atualizar     │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░                │
└──────────────────────────────────────────────────────┘
```

Sem barra de porcentagem exata (compliance não tem progresso granular), apenas indicador indeterminado com tempo decorrido.

### Arquivos editados (2)
- `src/pages/firewall/FirewallCompliancePage.tsx`
- `src/pages/external-domain/ExternalDomainCompliancePage.tsx`

