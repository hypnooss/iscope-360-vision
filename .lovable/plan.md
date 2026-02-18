
# Adicionar Colunas Fabricante, Agent e Frequência na Tabela de Compliance

## O que será feito

Adicionar três colunas entre "Workspace" e "Último Score" na tabela de Firewall > Compliance:

| Coluna | Origem dos dados |
|---|---|
| **Fabricante** | `device_types.vendor` via `firewall.device_type_id` |
| **Agent** | `agents.name` via `firewall.agent_id` |
| **Frequência** | `analysis_schedules.frequency` via `firewall_id` |

---

## Mudanças técnicas em `src/pages/firewall/FirewallReportsPage.tsx`

### 1. Expandir `firewallsMeta` e `GroupedFirewall` com os novos campos

Adicionar os campos nas interfaces e no estado:

```ts
// firewallsMeta state type — adicionar:
vendor_name: string | null;
agent_name: string | null;
schedule_frequency: string | null;

// GroupedFirewall interface — adicionar:
vendor_name: string | null;
agent_name: string | null;
schedule_frequency: string | null;
```

### 2. Expandir `fetchReports` com 3 consultas adicionais

Após buscar `firewallsData`, adicionar:

```ts
// a) Buscar device types das ids presentes
const deviceTypeIds = [...new Set(firewallsData.map(f => f.device_type_id).filter(Boolean))];
const { data: deviceTypesData } = await supabase
  .from('device_types')
  .select('id, vendor, name')
  .in('id', deviceTypeIds);
const deviceTypeMap = new Map((deviceTypesData || []).map(dt => [dt.id, dt]));

// b) Buscar agents das ids presentes
const agentIds = [...new Set(firewallsData.map(f => f.agent_id).filter(Boolean))];
const { data: agentsData } = await supabase
  .from('agents')
  .select('id, name')
  .in('id', agentIds);
const agentMap = new Map((agentsData || []).map(a => [a.id, a]));

// c) Buscar schedules para os firewall_ids
const { data: schedulesData } = await supabase
  .from('analysis_schedules')
  .select('firewall_id, frequency')
  .in('firewall_id', firewallIds)
  .eq('is_active', true);
const scheduleMap = new Map((schedulesData || []).map(s => [s.firewall_id, s]));
```

### 3. Popular os novos campos em `setFirewallsMeta`

```ts
setFirewallsMeta(firewallsData.map(f => ({
  // campos existentes...
  vendor_name: f.device_type_id ? deviceTypeMap.get(f.device_type_id)?.vendor || null : null,
  agent_name: f.agent_id ? agentMap.get(f.agent_id)?.name || null : null,
  schedule_frequency: scheduleMap.get(f.id)?.frequency || null,
})));
```

### 4. Propagar os campos no `groupedFirewalls` (useMemo)

No `seed` dos firewalls a partir de `filteredMeta`, passar os três novos campos. No seed de análises sem meta, colocar `null`.

### 5. Adicionar `<TableHead>` — três novas colunas

```tsx
<TableHead>Workspace</TableHead>
<TableHead>Fabricante</TableHead>   {/* NOVA */}
<TableHead>Agent</TableHead>        {/* NOVA */}
<TableHead>Frequência</TableHead>   {/* NOVA */}
<TableHead>Último Score</TableHead>
```

### 6. Adicionar `<TableCell>` — três novas células por linha

```tsx
{/* Fabricante */}
<TableCell>
  {group.vendor_name ? (
    <span className="text-sm text-foreground">{group.vendor_name}</span>
  ) : (
    <span className="text-muted-foreground text-sm">—</span>
  )}
</TableCell>

{/* Agent */}
<TableCell>
  {group.agent_name ? (
    <Badge variant="outline" className="text-xs font-mono">{group.agent_name}</Badge>
  ) : (
    <span className="text-muted-foreground text-sm">—</span>
  )}
</TableCell>

{/* Frequência */}
<TableCell>
  {group.schedule_frequency ? (
    <Badge variant="secondary" className="text-xs capitalize">
      {frequencyLabel(group.schedule_frequency)}
    </Badge>
  ) : (
    <span className="text-muted-foreground text-sm">Manual</span>
  )}
</TableCell>
```

### 7. Adicionar helper `frequencyLabel`

```ts
const frequencyLabel = (freq: string) => {
  const map: Record<string, string> = {
    daily: 'Diário',
    weekly: 'Semanal',
    monthly: 'Mensal',
    manual: 'Manual',
  };
  return map[freq] || freq;
};
```

## Arquivo alterado

- `src/pages/firewall/FirewallReportsPage.tsx` — único arquivo modificado
