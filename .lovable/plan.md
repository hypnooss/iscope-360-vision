

# Diagnóstico: Supabase Nano ainda saturado — Otimizações Adicionais

## Situação atual

Os logs do Postgres mostram **statement timeouts contínuos** em queries triviais (`agents`, `system_alerts`, `user_roles`). Até queries de autenticação (`/auth/v1/user`) retornam 504. O banco está no limite de conexões/CPU.

As otimizações de polling já aplicadas reduziram a frequência, mas o volume total ainda excede a capacidade do Nano.

## Causas residuais identificadas

### 1. `refetchOnWindowFocus: true` (padrão do React Query)
O `QueryClient` em `App.tsx` é criado sem configuração. Por padrão, **toda query re-executa quando o usuário volta à aba do browser**. Com ~15 queries ativas no dashboard, cada alt-tab gera um pico de 15+ queries simultâneas.

### 2. Dashboard faz ~10 queries paralelas no load
`useDashboardStats` dispara 4 queries iniciais + 6 queries de histórico em `Promise.all`. Todas competem pelas mesmas conexões do pool.

### 3. `checkMfaStatus` faz 3 chamadas auth desnecessárias
Cada auth state change chama `getAuthenticatorAssuranceLevel()` + `listFactors()` + `getSession()` — 3 requests ao Supabase Auth. Com o trusted device, a terceira chamada (`getSession`) é redundante pois já temos a session no state.

### 4. Realtime subscriptions em `system_alerts`
`SystemAlertBanner` mantém 3 subscriptions Realtime (INSERT, UPDATE, DELETE) que, embora leves, adicionam conexões ao pool.

## Plano de Otimização

### Mudança 1: Configurar `QueryClient` com defaults globais
Em `src/App.tsx`, adicionar:
- `refetchOnWindowFocus: false` — elimina picos de queries ao trocar abas
- `retry: 1` — reduz retries em caso de timeout (padrão é 3)
- `staleTime: 30_000` — default global de 30s para evitar re-fetches desnecessários

### Mudança 2: Otimizar `checkMfaStatus` no AuthContext
Remover a chamada redundante a `supabase.auth.getSession()` dentro do `checkMfaStatus`. O `user` já está disponível no state (`session?.user`). Usar o `user.id` diretamente ao invés de fazer uma chamada extra.

### Mudança 3: Serializar queries do Dashboard
Em `useDashboardStats`, mudar de 4+6 queries paralelas para uma abordagem sequencial em 2 estágios: primeiro buscar IDs dos assets, depois buscar dados em lotes menores (máximo 3 queries paralelas por vez).

### Mudança 4: Adicionar índices ao banco
Criar índices compostos para as queries que mais aparecem nos timeouts:
- `agents(client_id, revoked)` — query mais frequente nos logs
- `system_alerts(is_active, created_at DESC)` — segunda mais frequente

### Arquivos alterados
- `src/App.tsx` — QueryClient defaults
- `src/contexts/AuthContext.tsx` — eliminar getSession redundante
- `src/hooks/useDashboardStats.ts` — throttle de queries paralelas
- Migration SQL — índices

