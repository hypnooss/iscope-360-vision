

# Fix: Posicao do BAU-FW e Animacao de Ataque

## Problema 1: BAU-FW posicionado na Europa (Romania)

A query `firewall-wan-ip` busca a tarefa completada mais recente **sem filtrar por tipo**. A tarefa mais recente do BAU-FW e do tipo `firewall_analyzer`, que nao possui o step `system_interface` (apenas tarefas `fortigate_compliance` tem esse step). Resultado: a query retorna `null`, cai no fallback 4 (IP de falha de auth) e geolocalizou para Romania (44.43, 26.10) -- onde fica o atacante, nao o firewall.

### Correcao

No arquivo `src/pages/firewall/AnalyzerDashboardPage.tsx`, adicionar filtro `task_type = 'fortigate_compliance'` na query `firewall-wan-ip`:

```typescript
const { data: tasks } = await supabase
  .from('agent_tasks')
  .select('id')
  .eq('target_id', selectedFirewall)
  .eq('task_type', 'fortigate_compliance')  // NOVO - filtrar tipo correto
  .eq('status', 'completed')
  .order('completed_at', { ascending: false })
  .limit(1);
```

Isso garante que o step `system_interface` exista na tarefa encontrada, extraindo o IP WAN correto (187.32.89.65) e geolocalizando para Bauru/SP.

## Problema 2: Animacao de ataque quase invisivel

As linhas de conexao entre pontos de ataque e o firewall tem `opacity="0.15"` e `strokeWidth="1"`, o que torna a animacao praticamente invisivel no mapa escuro.

### Correcao

No arquivo `src/components/firewall/AttackMap.tsx`, aumentar visibilidade das linhas animadas:

- `opacity`: de `0.15` para `0.45`
- `strokeWidth`: de `1` para `1.5`
- Animacao de dash-offset: manter, funciona corretamente

Essas mudancas tornam as linhas tracejadas animadas visiveis sem poluir o mapa.

## Resumo das alteracoes

| Arquivo | Mudanca |
|---------|---------|
| `AnalyzerDashboardPage.tsx` | Adicionar `.eq('task_type', 'fortigate_compliance')` na query WAN IP |
| `AttackMap.tsx` | Aumentar `opacity` e `strokeWidth` das linhas de conexao |

