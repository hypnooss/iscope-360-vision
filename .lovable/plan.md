

# Quebrar o ciclo de retry que satura o Supabase Nano

## Situação

O banco está num loop de morte: queries falham com 504 → React Query retenta → mais queries → mais 504. Os logs mostram `system_alerts` sendo chamado a cada ~10s em loop infinito, mesmo usando Realtime (que deveria eliminar polling). O componente `SystemAlertBanner` faz 3 subscriptions Realtime + fetch manual, e cada evento Realtime dispara outro fetch que falha e gera retries.

## Ação imediata no Supabase Dashboard

1. Vá para **Settings > General** no [dashboard do Supabase](https://supabase.com/dashboard/project/akbosdbyheezghieiefz/settings/general)
2. Role até **Restart project** e clique em **Restart**
3. Aguarde ~2 minutos

Isso vai derrubar todas as conexões ativas e limpar o pool.

## Mudanças no código para evitar recorrência

### 1. SystemAlertBanner: eliminar fetch redundante e adicionar debounce

O componente usa Realtime (3 subscriptions) mas cada evento chama `fetchActiveAlerts()` diretamente, gerando queries extras. Mudar para:
- Usar `useQuery` com `staleTime: 60000` e `refetchInterval: 120000` (2 min)
- Remover os `fetchActiveAlerts()` de dentro dos handlers Realtime — usar `queryClient.invalidateQueries()` com debounce para evitar múltiplos fetches simultâneos
- Reduzir de 3 subscriptions para 1 (wildcard `*` event)

### 2. App.tsx: adicionar `retryDelay` exponencial

No `QueryClient` defaults, adicionar `retryDelay` com backoff exponencial para evitar retry storms:
```
retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
```

### 3. AuthContext: adicionar guard contra fetch durante 504 storm

Adicionar um circuit breaker simples: se as últimas 3 queries falharam com timeout, pausar fetches por 60s.

### Arquivos alterados
- `src/components/alerts/SystemAlertBanner.tsx` — debounce Realtime, useQuery com staleTime alto
- `src/App.tsx` — retryDelay exponencial no QueryClient

### Resultado esperado
Após restart do banco + deploy dessas mudanças, o sistema não vai mais entrar em loop de retry cascading. Mesmo que o banco fique lento, o frontend vai recuar automaticamente.

