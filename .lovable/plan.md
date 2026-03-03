

## Plano: Coluna "Tipo" com badges + Seletor no topo das páginas de Execuções

### Contexto
- **Domínio Externo** e **M365** já possuem coluna "Tipo" com badges coloridas usando `typeConfig` — estão OK
- **Firewall** tem coluna "Tipo" mas renderiza `task.task_type` como texto monospace sem badge estilizada
- Nenhuma das 3 páginas de Execuções tem seletor de workspace/firewall/domain/tenant no topo

### Alterações

**1. `src/pages/firewall/TaskExecutionsPage.tsx`**
- Adicionar `typeConfig` com badges estilizadas para `fortigate_analysis`, `fortigate_analyzer` e fallback, usando o mesmo padrão visual do SchedulesPage (ícone + label colorido)
- Substituir o `<Badge variant="outline" className="font-mono text-xs">{task.task_type}</Badge>` pelo badge estilizado
- Adicionar seletor de Workspace (para super_admin) e Firewall no topo, ao lado do botão "Atualizar", usando `useWorkspaceSelector` + `useFirewallSelector` + `Select`
- Filtrar as tasks pelo firewall selecionado (quando selecionado)

**2. `src/pages/external-domain/ExternalDomainExecutionsPage.tsx`**
- Adicionar seletor de Workspace (para super_admin) e Domínio no topo usando `useWorkspaceSelector` + `useDomainSelector` + `Select`
- Filtrar execuções pelo domínio selecionado (quando selecionado)

**3. `src/pages/m365/M365ExecutionsPage.tsx`**
- Adicionar `TenantSelector` no topo (lado direito) usando `useM365TenantSelector` + `useWorkspaceSelector`
- Filtrar execuções pelo tenant selecionado (quando selecionado)

### Badges de Tipo — Padrão Visual (Firewall)

| task_type | Label | Cor |
|-----------|-------|-----|
| `fortigate_analysis` | Firewall | orange |
| `fortigate_analyzer` | Firewall Analyzer | rose/red |
| fallback | task_type raw | muted |

### Seletores — Posição
No header de cada página, à direita, entre o título e o botão "Atualizar", seguindo o mesmo layout das páginas de Compliance.

