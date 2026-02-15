
# Exibir Agendamentos de Attack Surface no Painel de Agendamentos

## Problema

A pagina `/schedules` (SchedulesPage.tsx) busca dados apenas de duas tabelas:
- `analysis_schedules` (Firewalls)
- `external_domain_schedules` (Dominios Externos)

Os agendamentos de Attack Surface Analyzer ficam na tabela `attack_surface_schedules` (6 registros ativos), que nao e consultada pela pagina.

## Solucao

Adicionar uma terceira query para buscar os dados de `attack_surface_schedules`, unificando-os na mesma lista.

## Detalhes tecnicos

### Arquivo: `src/pages/admin/SchedulesPage.tsx`

1. **Atualizar o tipo `UnifiedSchedule`**: Adicionar `'attack_surface'` ao campo `targetType`:
   ```typescript
   targetType: 'firewall' | 'external_domain' | 'attack_surface';
   ```

2. **Nova query**: Buscar `attack_surface_schedules` com join em `clients`:
   ```typescript
   const { data: attackSurfaceSchedules, isLoading: loadingAs, refetch: refetchAs } = useQuery({
     queryKey: ['admin-schedules-as'],
     refetchInterval: 30_000,
     queryFn: async () => {
       const { data, error } = await supabase
         .from('attack_surface_schedules')
         .select('id, client_id, frequency, is_active, next_run_at, scheduled_hour, scheduled_day_of_week, scheduled_day_of_month, clients(id, name)')
         .order('next_run_at', { ascending: true, nullsFirst: false });
       if (error) throw error;
       return (data || []).map((s) => ({
         id: s.id,
         targetId: s.client_id,
         targetName: s.clients?.name || '—',
         targetType: 'attack_surface',
         frequency: s.frequency,
         isActive: s.is_active,
         nextRunAt: s.next_run_at,
         scheduledHour: s.scheduled_hour,
         scheduledDayOfWeek: s.scheduled_day_of_week,
         scheduledDayOfMonth: s.scheduled_day_of_month,
         clientId: s.client_id,
         clientName: s.clients?.name || '—',
         lastScore: null,
       }));
     },
   });
   ```

3. **Unificar listas**: Incluir `attackSurfaceSchedules` no merge:
   ```typescript
   const all = [...(firewallSchedules || []), ...(domainSchedules || []), ...(attackSurfaceSchedules || [])];
   ```

4. **Loading e refresh**: Incluir `loadingAs` no `isLoading` e `refetchAs` no `handleRefresh`.

5. **Badge de tipo**: Adicionar renderizacao para `attack_surface` no `renderTypeBadge`:
   ```typescript
   if (type === 'attack_surface') {
     return (
       <Badge variant="outline" className="bg-violet-500/15 text-violet-400 border-violet-500/30 gap-1">
         <Crosshair className="w-3 h-3" />
         Attack Surface
       </Badge>
     );
   }
   ```

6. **Filtro de tipo**: Adicionar opcao no Select de tipo:
   ```typescript
   <SelectItem value="attack_surface">Attack Surface</SelectItem>
   ```

7. **Status da ultima tarefa**: Os scans de attack surface nao usam `agent_tasks` da mesma forma, entao para esses registros o status sera "Sem execucao" (comportamento atual de fallback), o que e aceitavel por enquanto.

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `SchedulesPage.tsx` | Adicionar query de `attack_surface_schedules`, unificar na lista, badge e filtro |
