

# Auto-refresh para a pagina de Agendamentos

## Problema

Os dados da pagina de Agendamentos sao carregados uma unica vez e nunca atualizados. Os textos relativos como "em 9 minutos" ficam desatualizados porque o `formatDistanceToNow` so e calculado no momento da renderizacao inicial.

## Solucao

Adicionar `refetchInterval` nas queries do React Query para recarregar os dados periodicamente, e tambem forcar re-render dos textos relativos.

## Alteracoes

### Arquivo: `src/pages/admin/SchedulesPage.tsx`

1. Adicionar `refetchInterval: 30_000` (30 segundos) na query `admin-schedules` para manter os dados atualizados
2. Adicionar `refetchInterval: 30_000` na query `admin-schedule-tasks`
3. Adicionar um estado de "tick" com `setInterval` de 30s para forcar o recalculo dos textos relativos (`formatDistanceToNow`) mesmo que os dados nao mudem

```tsx
// Adicionar nas queries:
const { data: schedules, isLoading } = useQuery({
  queryKey: ['admin-schedules'],
  refetchInterval: 30_000,
  queryFn: async () => { ... },
});

const { data: latestTasks } = useQuery({
  queryKey: ['admin-schedule-tasks', firewallIds],
  enabled: firewallIds.length > 0,
  refetchInterval: 30_000,
  queryFn: async () => { ... },
});

// Adicionar tick para forcar re-render dos textos relativos:
const [, setTick] = useState(0);
useEffect(() => {
  const interval = setInterval(() => setTick(t => t + 1), 30_000);
  return () => clearInterval(interval);
}, []);
```

Isso garante que tanto os dados quanto os textos relativos de tempo sejam atualizados a cada 30 segundos.

