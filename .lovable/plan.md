
# Adicionar Firewall Analyzer em Administração > Agendamentos

## Problema

A página `/schedules` exibe agendamentos de três fontes:
1. `analysis_schedules` — Compliance do Firewall (badge "Firewall")
2. `external_domain_schedules` — Domínios Externos
3. `attack_surface_schedules` — Attack Surface

A tabela `analyzer_schedules` (Firewall Analyzer) nunca foi incluída nessa listagem.

## Mudanças em `src/pages/admin/SchedulesPage.tsx`

### 1. Novo tipo para `targetType`

Adicionar `'firewall_analyzer'` à união do `UnifiedSchedule`:

```ts
targetType: 'firewall' | 'external_domain' | 'attack_surface' | 'firewall_analyzer';
```

### 2. Nova query — `analyzer_schedules`

```ts
const { data: analyzerSchedules, isLoading: loadingAn, refetch: refetchAn } = useQuery({
  queryKey: ['admin-schedules-an'],
  refetchInterval: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('analyzer_schedules')
      .select('id, firewall_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, firewalls(id, name, last_score, client_id, clients(id, name))')
      .order('next_run_at', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return ((data || []) as any[]).map((s): UnifiedSchedule => ({
      id: s.id,
      targetId: s.firewall_id,
      targetName: s.firewalls?.name || '—',
      targetType: 'firewall_analyzer',
      frequency: s.frequency,
      isActive: s.is_active,
      nextRunAt: s.next_run_at,
      scheduledHour: s.scheduled_hour,
      scheduledDayOfWeek: s.scheduled_day_of_week,
      scheduledDayOfMonth: s.scheduled_day_of_month,
      clientId: s.firewalls?.clients?.id || '',
      clientName: s.firewalls?.clients?.name || '—',
      lastScore: s.firewalls?.last_score ?? null,
    }));
  },
});
```

### 3. Incluir na lista unificada e no `isLoading`

```ts
const isLoading = loadingFw || loadingDom || loadingAs || loadingAn;

const schedules = useMemo(() => {
  const all = [
    ...(firewallSchedules || []),
    ...(domainSchedules || []),
    ...(attackSurfaceSchedules || []),
    ...(analyzerSchedules || []),   // <-- novo
  ];
  // ... sort
}, [firewallSchedules, domainSchedules, attackSurfaceSchedules, analyzerSchedules]);
```

### 4. Badge para `firewall_analyzer`

Adicionar novo caso em `renderTypeBadge`:

```tsx
if (type === 'firewall_analyzer') {
  return (
    <Badge variant="outline" className="bg-rose-500/15 text-rose-400 border-rose-500/30 gap-1">
      <Activity className="w-3 h-3" />
      FW Analyzer
    </Badge>
  );
}
```

Importar o ícone `Activity` do `lucide-react`.

### 5. Filtro por tipo — adicionar opção "FW Analyzer"

```tsx
<SelectItem value="firewall_analyzer">FW Analyzer</SelectItem>
```

### 6. Labels e cores de frequência — adicionar `hourly`

```ts
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  hourly: 'Por Hora',   // <-- novo
};

const FREQUENCY_COLORS: Record<string, string> = {
  daily: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  monthly: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  hourly: 'bg-teal-500/15 text-teal-400 border-teal-500/30',   // <-- novo
};
```

### 7. Descrição da programação — suporte a `hourly`

Adicionar case no `getScheduleDescription`:

```ts
case 'hourly':
  return 'A cada hora';
```

### 8. Adicionar `refetchAn` no `handleRefresh`

```ts
const handleRefresh = () => {
  refetchFw();
  refetchDom();
  refetchAs();
  refetchAn();  // <-- novo
};
```

### 9. Filtro de Frequência — adicionar "Por Hora"

```tsx
<SelectItem value="hourly">Por Hora</SelectItem>
```

## Arquivo modificado

- `src/pages/admin/SchedulesPage.tsx`
